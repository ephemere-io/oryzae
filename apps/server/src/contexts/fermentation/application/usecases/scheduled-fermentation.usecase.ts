import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { Entry } from '../../../entry/domain/models/entry.js';
import type { EntryQuestionLinkRepositoryGateway } from '../../../question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '../../../question/domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '../../../question/domain/gateways/question-transaction-repository.gateway.js';
import type { FermentationRepositoryGateway } from '../../domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '../../domain/gateways/llm-analysis.gateway.js';
import { RunFermentationUsecase } from './run-fermentation.usecase.js';

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
    private entryQuestionLinkRepo: EntryQuestionLinkRepositoryGateway,
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
    const usersWithEntries: Array<{ userId: string; entries: Entry[] }> = [];

    for (const userId of userIds) {
      const entries = await this.entryRepo.listByUserIdAndDate(userId, dateKey);
      if (entries.length > 0) {
        usersWithEntries.push({ userId, entries });
      }
    }

    result.totalUsers = usersWithEntries.length;

    // 2. For each user, run fermentation per active question using only entries linked to that question
    const runUsecase = new RunFermentationUsecase(
      this.fermentationRepo,
      this.llmGateway,
      this.generateId,
    );

    for (const { userId, entries } of usersWithEntries) {
      const activeQuestions = await this.questionRepo.listActiveByUserId(userId);
      if (activeQuestions.length === 0) continue;

      for (const question of activeQuestions) {
        const linkedEntryIds = new Set(
          await this.entryQuestionLinkRepo.listEntryIdsByQuestionId(question.id),
        );
        const questionEntries = entries.filter((e) => linkedEntryIds.has(e.toProps().id));
        if (questionEntries.length === 0) continue;

        result.totalFermentations++;

        const latestTransaction =
          await this.questionTransactionRepo.findLatestValidatedByQuestionId(question.id);
        if (!latestTransaction) continue;

        const questionText = latestTransaction.toProps().string;
        const combinedContent = questionEntries.map((e) => e.toProps().content).join('\n\n---\n\n');
        const entryId = questionEntries[0].toProps().id;

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
