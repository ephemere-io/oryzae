import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway.js';
import type { QuestionProps } from '../../domain/models/question.js';

export class ListActiveQuestionsUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
  ) {}

  async execute(userId: string): Promise<Array<QuestionProps & { currentText: string | null }>> {
    const questions = await this.questionRepo.listActiveByUserId(userId);
    const results = [];
    for (const q of questions) {
      const tx = await this.transactionRepo.findLatestValidatedByQuestionId(q.id);
      results.push({ ...q.toProps(), currentText: tx?.string ?? null });
    }
    return results;
  }
}
