import type { EntryQuestionLinkRepositoryGateway } from '../../domain/gateways/entry-question-link-repository.gateway';
import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway';
import type { QuestionProps } from '../../domain/models/question';

export class ListEntryQuestionsUsecase {
  constructor(
    private linkRepo: EntryQuestionLinkRepositoryGateway,
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
  ) {}

  async execute(
    entryId: string,
  ): Promise<Array<QuestionProps & { currentText: string | null }>> {
    const questionIds =
      await this.linkRepo.listQuestionIdsByEntryId(entryId);
    const results = [];
    for (const qId of questionIds) {
      const question = await this.questionRepo.findById(qId);
      if (!question) continue;
      const tx =
        await this.transactionRepo.findLatestValidatedByQuestionId(qId);
      results.push({ ...question.toProps(), currentText: tx?.string ?? null });
    }
    return results;
  }
}
