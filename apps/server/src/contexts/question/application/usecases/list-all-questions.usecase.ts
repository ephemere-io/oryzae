import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway';
import type { QuestionProps } from '../../domain/models/question';

export class ListAllQuestionsUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
  ) {}

  async execute(userId: string): Promise<Array<QuestionProps & { currentText: string | null }>> {
    const questions = await this.questionRepo.listAllByUserId(userId);
    const results = [];
    for (const q of questions) {
      const tx = await this.transactionRepo.findLatestValidatedByQuestionId(q.id);
      results.push({ ...q.toProps(), currentText: tx?.string ?? null });
    }
    return results;
  }
}
