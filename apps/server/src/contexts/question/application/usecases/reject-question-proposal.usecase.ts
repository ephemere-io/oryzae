import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway';
import {
  QuestionNotFoundError,
  QuestionNotPendingError,
} from '../errors/question.errors';

export class RejectQuestionProposalUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
  ) {}

  async execute(questionId: string): Promise<void> {
    const question = await this.questionRepo.findById(questionId);
    if (!question) throw new QuestionNotFoundError(questionId);

    if (!question.isValidatedByUser) {
      // Entire question is an unvalidated proposal — delete it (cascades transactions)
      await this.questionRepo.delete(questionId);
      return;
    }

    // Text update proposal — delete only the unvalidated transaction
    const unvalidatedTx =
      await this.transactionRepo.findLatestUnvalidatedByQuestionId(questionId);
    if (!unvalidatedTx) throw new QuestionNotPendingError(questionId);

    await this.transactionRepo.delete(unvalidatedTx.id);
  }
}
