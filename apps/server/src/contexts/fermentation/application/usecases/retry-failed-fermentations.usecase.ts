import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '../../../question/domain/gateways/question-transaction-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '../../domain/gateways/llm-analysis.gateway.js';
import type { UserLocaleResolverGateway } from '../../domain/gateways/user-locale-resolver.gateway.js';
import type { FermentationLanguage } from '../../domain/services/fermentation-eligibility.service.js';
import { RunFermentationUsecase } from './run-fermentation.usecase.js';

export interface RetryFailedFermentationsResult {
  // 窓内で見つかった未完了結果の総数（cap 適用前）。
  totalCandidates: number;
  // cap で打ち切られた件数（> 0 なら今回リトライされず次の窓からも外れる = 取りこぼし）。
  truncated: number;
  // 実際にリトライを試みた件数。
  attempted: number;
  succeeded: number;
  failed: number;
  // 問い文 or スキャン済みエントリが復元できずスキップした件数。
  skipped: number;
  errors: Array<{ userId: string; fermentationResultId: string; error: string }>;
  emailFailures: Array<{ userId: string; error: string }>;
}

// 1 run でリトライする上限。リトライは LLM を都度叩くため重い。Vercel maxDuration(800s) を
// 通常 sweep の後に共有するので、大量失敗の翌日でも sweep を含めて時間切れにならないよう
// 上限で守る。worker-pool 並列(concurrency)前提で ~30 件なら余裕で収まる。打ち切った分は
// ログに出す（one-shot 窓なので次回も拾われず取りこぼしになるため、可観測にする）。
const MAX_RETRIES_PER_RUN = 30;

// リトライ対象の時間窓（時間）。cron は 24h 毎なので 24h + マージン。前回 run の失敗だけが
// 入り、2日前以前は外れる（行を再利用し created_at 不変のため one-shot リトライになる）。
const WINDOW_HOURS = 30;

/**
 * issue #353: 前回 cron で完了しなかった発酵を、次回 cron で1回だけリトライする。
 *
 * ScheduledFermentationUsecase の sweep 直後に呼ばれる。窓 [now - WINDOW_HOURS, now) の
 * 未完了結果（failed / processing / pending）を拾い、元の行を再利用して再実行する。
 * 行を再利用するので created_at は変わらず、翌日には窓から外れて二重リトライしない。
 * beforeIso=now により、今 run の sweep が生んだ新規行（created_at > now）は除外される。
 *
 * 成功したらユーザー単位で digest をまとめて1通送る（#384 と同じバッチ方針）。
 */
export class RetryFailedFermentationsUsecase {
  constructor(
    private fermentationRepo: FermentationRepositoryGateway,
    private entryRepo: EntryRepositoryGateway,
    private questionTransactionRepo: QuestionTransactionRepositoryGateway,
    private localeResolver: UserLocaleResolverGateway,
    private llmGateway: LlmAnalysisGateway,
    private generateId: () => string,
    // 成功したユーザーへ digest をまとめて送るコールバック（ScheduledFermentation と同形）。
    private sendDigest: (
      userId: string,
      questionTitles: string[],
      language: FermentationLanguage,
    ) => Promise<unknown>,
    // ユーザー並列実行数。テストでは 1 を渡して順序を決定論的にできる。
    private concurrency: number = 4,
    // 1 run の上限。テストで小さくして打ち切りを検証する。
    private maxRetries: number = MAX_RETRIES_PER_RUN,
    // 窓の長さ（時間）。テストで挙動を固定するため注入可能。
    private windowHours: number = WINDOW_HOURS,
  ) {}

  async execute(now: Date = new Date()): Promise<RetryFailedFermentationsResult> {
    const result: RetryFailedFermentationsResult = {
      totalCandidates: 0,
      truncated: 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      emailFailures: [],
    };

    const beforeIso = now.toISOString();
    const sinceIso = new Date(now.getTime() - this.windowHours * 60 * 60 * 1000).toISOString();

    const candidates = await this.fermentationRepo.listRetryable(sinceIso, beforeIso);
    result.totalCandidates = candidates.length;
    if (candidates.length === 0) return result;

    // cap 適用。listRetryable は created_at 昇順なので、古い（=長く待たされている）順に拾う。
    const targets = candidates.slice(0, this.maxRetries);
    result.truncated = candidates.length - targets.length;
    if (result.truncated > 0) {
      console.warn('[RetryFailedFermentationsUsecase] truncated retry batch', {
        total: candidates.length,
        cap: this.maxRetries,
        dropped: result.truncated,
      });
    }

    const runUsecase = new RunFermentationUsecase(
      this.fermentationRepo,
      this.llmGateway,
      this.generateId,
    );

    // ユーザー単位にまとめる（digest を1通にするため + worker をユーザー単位にするため）。
    const byUser = new Map<string, typeof targets>();
    for (const r of targets) {
      const userId = r.toProps().userId;
      const list = byUser.get(userId) ?? [];
      list.push(r);
      byUser.set(userId, list);
    }

    // 1 ユーザー分のリトライ処理。共有 state を mutate するが、JS シングルスレッドかつ
    // await 境界での mutate のみのため worker 間競合は起きない（ScheduledFermentation と同様）。
    const processUser = async (userId: string): Promise<void> => {
      const userTargets = byUser.get(userId) ?? [];
      const language = await this.localeResolver.resolve(userId);
      const successfulTitles: string[] = [];

      for (const target of userTargets) {
        const props = target.toProps();

        // 問い文を復元（最新の validated transaction）。無ければリトライ不能なのでスキップ。
        const transaction = await this.questionTransactionRepo.findLatestValidatedByQuestionId(
          props.questionId,
        );
        if (!transaction) {
          result.skipped++;
          continue;
        }
        const questionText = transaction.toProps().string;

        // 元 run でスキャンしたエントリを復元する。saveScannedEntries で保存済み。
        const scannedIds = await this.fermentationRepo.listScannedEntryIds(props.id);
        const entries = (await this.entryRepo.findByIds(scannedIds)).map((e) => {
          const ep = e.toProps();
          return { id: ep.id, content: ep.content };
        });
        // エントリが消えている等で復元できなければスキップ（RunFermentation は0件で throw する）。
        if (entries.length === 0) {
          result.skipped++;
          continue;
        }

        result.attempted++;
        try {
          await runUsecase.execute({
            userId,
            questionId: props.questionId,
            questionText,
            entries,
            language,
            retryOf: target,
          });
          result.succeeded++;
          successfulTitles.push(questionText);
        } catch (error) {
          result.failed++;
          const reason = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({ userId, fermentationResultId: props.id, error: reason });
        }
      }

      // 成功した問いがあればまとめて digest を1通送る（#384 と同じバッチ方針）。
      if (successfulTitles.length > 0) {
        try {
          await this.sendDigest(userId, successfulTitles, language);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[RetryFailedFermentationsUsecase] digest email failed', {
            userId,
            titleCount: successfulTitles.length,
            error: message,
          });
          result.emailFailures.push({ userId, error: message });
        }
      }
    };

    // worker-pool でユーザーを並列処理（ScheduledFermentationUsecase と同方式）。
    const queue = [...byUser.keys()];
    const workerCount = Math.min(this.concurrency, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const userId = queue.shift();
        if (!userId) return;
        await processUser(userId);
      }
    });
    await Promise.all(workers);

    return result;
  }
}
