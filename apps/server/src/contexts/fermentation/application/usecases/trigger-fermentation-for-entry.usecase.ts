import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '../../domain/gateways/llm-analysis.gateway.js';
import { RunFermentationUsecase } from './run-fermentation.usecase.js';

/**
 * エントリ保存時に、ユーザーのアクティブな問い全てに対して発酵分析を実行する。
 * fire-and-forget で呼ばれるため、エラーはログに記録するだけ。
 */
export class TriggerFermentationForEntryUsecase {
  constructor(
    private fermentationRepo: FermentationRepositoryGateway,
    private llmGateway: LlmAnalysisGateway,
    private generateId: () => string,
  ) {}

  async execute(params: {
    userId: string;
    entryId: string;
    entryContent: string;
    activeQuestions: { id: string; currentText: string }[];
  }): Promise<void> {
    const runUsecase = new RunFermentationUsecase(
      this.fermentationRepo,
      this.llmGateway,
      this.generateId,
    );

    for (const question of params.activeQuestions) {
      try {
        await runUsecase.execute({
          userId: params.userId,
          questionId: question.id,
          questionText: question.currentText,
          entryId: params.entryId,
          entryContent: params.entryContent,
        });
      } catch (error) {
        console.error(
          `[Fermentation] Failed for question ${question.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
}
