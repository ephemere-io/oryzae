import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { Entry } from '../../../entry/domain/models/entry.js';
import type { EntryQuestionLinkRepositoryGateway } from '../../../question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../../question/domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '../../../question/domain/gateways/question-transaction-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '../../domain/gateways/llm-analysis.gateway.js';
import type { FermentationLanguage } from '../../domain/services/fermentation-eligibility.service.js';
import { RunFermentationUsecase } from './run-fermentation.usecase.js';

interface FireFermentationFiredItem {
  fermentationResultId: string;
  questionId: string;
  questionText: string;
}

interface FireFermentationResult {
  fired: FireFermentationFiredItem[];
}

// issue #290: admin デバッグ用に、特定ユーザー (+ 任意で特定問い) に対して
// 条件ゲート (文字数 / 時間 / readiness / fermentation_enabled) を **バイパス**
// して発酵を強制発火する。
//
// 重要な制約:
// - user_fermentation_state.lastRunAt / nextEligibleAt は更新しない
//   (本番のスケジューラーに影響を与えないため)。
// - エントリは entry_question_link で当該問いに紐付くもの全てを対象にする
//   (fermentation_enabled=true の制約も外す = デバッグ用なので最大スコープ)。
// - メール送信は呼び出し側 (route) の責務。本 usecase は発酵そのものに専念する。
export class FireFermentationUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private questionRepo: QuestionRepositoryGateway,
    private questionTransactionRepo: QuestionTransactionRepositoryGateway,
    private entryQuestionLinkRepo: EntryQuestionLinkRepositoryGateway,
    private fermentationRepo: FermentationRepositoryGateway,
    private llmGateway: LlmAnalysisGateway,
    private generateId: () => string,
  ) {}

  async execute(params: {
    userId: string;
    // 省略時は active 問い全てに対して発火
    questionId?: string;
    // 省略時は 'ja' (呼び出し側で SupabaseUserLocaleResolver を使って解決推奨)
    language?: FermentationLanguage;
  }): Promise<FireFermentationResult> {
    const language: FermentationLanguage = params.language ?? 'ja';

    // 1. 対象問いを決定 (active のみ。questionId 指定時はその 1 つに絞る)
    const activeQuestions = await this.questionRepo.listActiveByUserId(params.userId);
    const targetQuestions = params.questionId
      ? activeQuestions.filter((q) => q.id === params.questionId)
      : activeQuestions;
    if (params.questionId && targetQuestions.length === 0) {
      throw new Error(
        `Question ${params.questionId} not found or not active for user ${params.userId}`,
      );
    }
    if (targetQuestions.length === 0) {
      throw new Error(`No active questions found for user ${params.userId}`);
    }

    const runUsecase = new RunFermentationUsecase(
      this.fermentationRepo,
      this.llmGateway,
      this.generateId,
    );

    const fired: FireFermentationFiredItem[] = [];

    for (const question of targetQuestions) {
      // 2. 問いに紐付くエントリ ID を取得 (fermentation_enabled の制約はバイパス)
      const entryIds = await this.entryQuestionLinkRepo.listEntryIdsByQuestionId(question.id);
      if (entryIds.length === 0) continue;

      // 3. エントリ本体を取得 + 念のため userId 一致するもののみに絞る
      // (entry_question_link は user_id を持たないため、別ユーザーのエントリ
      // が混入していないかを防御的にチェック)。
      const allEntries = await this.entryRepo.findByIds(entryIds);
      const ownEntries = allEntries.filter((e: Entry) => e.toProps().userId === params.userId);
      if (ownEntries.length === 0) continue;

      // 4. 最新 validated transaction から問い文字列を取得
      const transaction = await this.questionTransactionRepo.findLatestValidatedByQuestionId(
        question.id,
      );
      if (!transaction) continue;
      const questionText = transaction.toProps().string;

      const runEntries = ownEntries.map((e) => {
        const props = e.toProps();
        return { id: props.id, content: props.content };
      });

      // 5. 発酵実行 (RunFermentationUsecase 内部で 'completed' / 'failed' の保存も完了)
      const { id } = await runUsecase.execute({
        userId: params.userId,
        questionId: question.id,
        questionText,
        entries: runEntries,
        language,
      });

      fired.push({
        fermentationResultId: id,
        questionId: question.id,
        questionText,
      });
    }

    if (fired.length === 0) {
      throw new Error(
        'No fermentations were fired (no linked entries or no validated transaction for any active question)',
      );
    }

    return { fired };
  }
}
