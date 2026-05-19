import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { Entry } from '../../../entry/domain/models/entry.js';
import type { EntryQuestionLinkRepositoryGateway } from '../../../question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../../question/domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '../../../question/domain/gateways/question-transaction-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '../../domain/gateways/llm-analysis.gateway.js';
import type { UserFermentationStateRepositoryGateway } from '../../domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '../../domain/gateways/user-locale-resolver.gateway.js';
import { UserFermentationState } from '../../domain/models/user-fermentation-state.js';
import {
  evaluateEligibility,
  type FermentationLanguage,
  rollRandomHours,
} from '../../domain/services/fermentation-eligibility.service.js';
import { RunFermentationUsecase } from './run-fermentation.usecase.js';

interface ScheduledFermentationResult {
  totalUsers: number;
  eligibleUsers: number;
  totalFermentations: number;
  succeeded: number;
  failed: number;
  errors: Array<{ userId: string; questionId: string; error: string }>;
  // issue #288: メール送信失敗を上位 (admin / Discord 通知) に伝えるため集計する。
  emailFailures: Array<{ userId: string; error: string }>;
}

// 発酵プロセス自動発火 (issue #268)。
// 一日一回、cron から呼ばれる。各ユーザーごとに以下を実施する:
//   1. ロケール解決 (Supabase Auth user_metadata.locale → 'ja' or 'en')
//   2. user_fermentation_state を読む (新規使用者は initial())
//   3. 文字数を集計 (lastRunAt 以降、または全期間)
//   4. evaluateEligibility() で eligible 判定 + readinessScore 計算
//   5. readinessScore と charsSinceLast を毎回 DB に upsert (admin/UI 反映用)
//   6. eligible なら fermentation_enabled=true のエントリで紐付く問いごとに発酵実行
//   7. 1問でも実行されたら次回 X 時間 (24-168h) を再ロールして state を更新
//
// 並列化 (issue #341): ユーザー処理を worker-pool で並列実行。
// LLM 1 呼び出しが数十秒かかるため、シリアルだと Vercel の 300s タイムアウトを
// 超えることが判明 (実害発生)。AI Gateway のレート制限と DB 同時接続を考慮し
// デフォルト同時実行 4 とした。質問単位のループは内側でシリアルのまま (各ユーザー
// 内の質問数は通常 1-3 で支配的でない)。
export class ScheduledFermentationUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private questionRepo: QuestionRepositoryGateway,
    private questionTransactionRepo: QuestionTransactionRepositoryGateway,
    private entryQuestionLinkRepo: EntryQuestionLinkRepositoryGateway,
    private fermentationRepo: FermentationRepositoryGateway,
    private userStateRepo: UserFermentationStateRepositoryGateway,
    private localeResolver: UserLocaleResolverGateway,
    private llmGateway: LlmAnalysisGateway,
    private generateId: () => string,
    private listActiveUserIds: () => Promise<string[]>,
    // issue #279: digest メールも language に応じて文言を切り替えるため、
    // ここで解決済みの language を呼び出し側に渡す。
    // 戻り値はスケジューラーでは使わないため Promise<unknown> で受ける
    // (issue #290 フォローで execute() が DigestSendResult を返すようになった)。
    private sendDigest: (
      userId: string,
      questionTitles: string[],
      language: FermentationLanguage,
    ) => Promise<unknown>,
    // 次回 X 時間生成器。テストでは固定値を注入して決定論的にする。
    private rollHours: () => number = rollRandomHours,
    // ユーザー並列実行数。テストでは 1 を渡して順序を決定論的にできる。
    private concurrency: number = 4,
  ) {}

  async execute(now: Date = new Date()): Promise<ScheduledFermentationResult> {
    const result: ScheduledFermentationResult = {
      totalUsers: 0,
      eligibleUsers: 0,
      totalFermentations: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      emailFailures: [],
    };

    const userIds = await this.listActiveUserIds();
    result.totalUsers = userIds.length;

    const runUsecase = new RunFermentationUsecase(
      this.fermentationRepo,
      this.llmGateway,
      this.generateId,
    );

    const successfulTitlesByUser = new Map<string, string[]>();
    const languageByUser = new Map<string, FermentationLanguage>();

    // 1 ユーザー分の処理。共有 state (result/Map) を mutate するが、JS シングル
    // スレッドかつ await 境界での mutate のみのため worker 間競合は起きない。
    const processUser = async (userId: string): Promise<void> => {
      // 1. ロケール解決 (失敗時は 'ja')
      const language = await this.localeResolver.resolve(userId);
      languageByUser.set(userId, language);

      // 2. 既存 state を取得 (新規なら null)
      const existing = await this.userStateRepo.findByUserId(userId);
      const state = existing ?? UserFermentationState.initial(userId, now);
      const sinceIso = existing?.lastRunAt ?? null;

      // 3. 文字数集計
      const totalChars = await this.entryRepo.countCharsByUserIdSince(userId, sinceIso);

      // 4. eligible 判定 + readiness 計算
      const evaluation = evaluateEligibility({
        state: existing,
        totalChars,
        language,
        now,
      });

      // 5. 毎回 readiness を DB に反映 (eligible でなくても admin/UI に必要)
      const readinessUpdate = state.withReadiness(totalChars, evaluation.readinessScore, now);
      const stateWithReadiness = readinessUpdate.success ? readinessUpdate.value : state;
      await this.userStateRepo.upsert(stateWithReadiness);

      if (!evaluation.eligible) return;

      // 6. 発火対象のエントリを取得 (lastRunAt 以降の fermentation_enabled=true)
      const fermentationEnabledEntries = await this.entryRepo.listFermentationEnabledByUserIdSince(
        userId,
        sinceIso,
      );
      if (fermentationEnabledEntries.length === 0) return;

      const activeQuestions = await this.questionRepo.listActiveByUserId(userId);
      if (activeQuestions.length === 0) return;

      let firedAtLeastOne = false;

      for (const question of activeQuestions) {
        const linkedEntryIds = new Set(
          await this.entryQuestionLinkRepo.listEntryIdsByQuestionId(question.id),
        );
        const questionEntries = fermentationEnabledEntries.filter((e: Entry) =>
          linkedEntryIds.has(e.toProps().id),
        );
        if (questionEntries.length === 0) continue;

        result.totalFermentations++;

        const latestTransaction =
          await this.questionTransactionRepo.findLatestValidatedByQuestionId(question.id);
        if (!latestTransaction) continue;

        const questionText = latestTransaction.toProps().string;
        const runEntries = questionEntries.map((e) => {
          const props = e.toProps();
          return { id: props.id, content: props.content };
        });

        try {
          await runUsecase.execute({
            userId,
            questionId: question.id,
            questionText,
            entries: runEntries,
            language,
          });
          result.succeeded++;
          firedAtLeastOne = true;
          const titles = successfulTitlesByUser.get(userId) ?? [];
          titles.push(questionText);
          successfulTitlesByUser.set(userId, titles);
        } catch (error) {
          result.failed++;
          firedAtLeastOne = true;
          result.errors.push({
            userId,
            questionId: question.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // 7. 1問でも発火していたら次回 X 時間を再ロールして state を更新。
      // 発火しなかった (= eligible だが fermentation_enabled エントリ or 紐付け問いが
      // 無かった) ユーザーは lastRunAt を進めず、再度書いたタイミングで判定される。
      if (firedAtLeastOne) {
        result.eligibleUsers++;
        const fired = stateWithReadiness.withFired(this.rollHours(), now);
        if (fired.success) {
          await this.userStateRepo.upsert(fired.value);
        }
      }
    };

    // worker-pool でユーザーを並列処理 (issue #341)。
    // queue.shift() を奪い合う方式で外部 dep なし。各 worker は順次次のユーザーを
    // 取りに行くため、処理時間のばらつきがあっても遊休が出にくい。
    const queue = [...userIds];
    const workerCount = Math.min(this.concurrency, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const userId = queue.shift();
        if (!userId) return;
        await processUser(userId);
      }
    });
    await Promise.all(workers);

    for (const [userId, titles] of successfulTitlesByUser) {
      const lang = languageByUser.get(userId) ?? 'ja';
      try {
        await this.sendDigest(userId, titles, lang);
      } catch (error) {
        // 設計思想: メール送信失敗は発酵ジョブ全体を止めない (issue #268)。
        // ただし黙殺せず、result に集計してログを出して上位の Discord 通知 / admin
        // 監視で発見できるようにする (issue #288)。
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ScheduledFermentationUsecase] digest email failed', {
          userId,
          titleCount: titles.length,
          error: message,
        });
        result.emailFailures.push({ userId, error: message });
      }
    }

    return result;
  }
}
