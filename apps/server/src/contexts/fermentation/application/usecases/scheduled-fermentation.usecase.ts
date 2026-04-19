import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../../question/domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '../../../question/domain/gateways/question-transaction-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '../../domain/gateways/llm-analysis.gateway.js';
import { RunFermentationUsecase } from './run-fermentation.usecase.js';

interface UserWithEntries {
  userId: string;
  entryIds: string[];
}

interface ScheduledFermentationResult {
  totalUsers: number;
  totalFermentations: number;
  succeeded: number;
  failed: number;
  errors: Array<{ userId: string; questionId: string; error: string }>;
}

export class ScheduledFermentationUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private questionRepo: QuestionRepositoryGateway,
    private questionTransactionRepo: QuestionTransactionRepositoryGateway,
    private fermentationRepo: FermentationRepositoryGateway,
    private llmGateway: LlmAnalysisGateway,
    private generateId: () => string,
    private listActiveUserIds: () => Promise<string[]>,
  ) {}

  async execute(dateKey: string): Promise<ScheduledFermentationResult> {
    const result: ScheduledFermentationResult = {
      totalUsers: 0,
      totalFermentations: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    // 1. Find users who wrote entries on the given date
    const userIds = await this.listActiveUserIds();
    const usersWithEntries: UserWithEntries[] = [];

    for (const userId of userIds) {
      const entries = await this.entryRepo.listFermentationEnabledByUserIdAndDate(userId, dateKey);
      if (entries.length > 0) {
        usersWithEntries.push({
          userId,
          entryIds: entries.map((e) => e.toProps().id),
        });
      }
    }

    result.totalUsers = usersWithEntries.length;

    // 2. For each user, get active questions and run fermentation
    const runUsecase = new RunFermentationUsecase(
      this.fermentationRepo,
      this.llmGateway,
      this.generateId,
    );

    for (const { userId, entryIds } of usersWithEntries) {
      const activeQuestions = await this.questionRepo.listActiveByUserId(userId);
      if (activeQuestions.length === 0) continue;

      // Get all entries for the day to combine content
      const entries = await this.entryRepo.listFermentationEnabledByUserIdAndDate(userId, dateKey);
      const combinedContent = entries.map((e) => e.toProps().content).join('\n\n---\n\n');

      // Use the first entry as the representative entry ID
      const entryId = entryIds[0];

      for (const question of activeQuestions) {
        result.totalFermentations++;

        // Get latest validated question text
        const latestTransaction =
          await this.questionTransactionRepo.findLatestValidatedByQuestionId(question.id);
        if (!latestTransaction) continue;

        const questionText = latestTransaction.toProps().string;

        try {
          await runUsecase.execute({
            userId,
            questionId: question.id,
            questionText,
            entryId,
            entryContent: combinedContent,
          });
          result.succeeded++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            userId,
            questionId: question.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return result;
  }
}
