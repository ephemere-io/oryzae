import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway';
import type { QuestionProps } from '../../domain/models/question';
import {
  QuestionNotFoundError,
  QuestionNotPendingError,
  QuestionLimitExceededError,
} from '../errors/question.errors';

export class AcceptQuestionProposalUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
  ) {}

  async execute(
    questionId: string,
  ): Promise<QuestionProps & { currentText: string }> {
    const question = await this.questionRepo.findById(questionId);
    if (!question) throw new QuestionNotFoundError(questionId);

    if (!question.isValidatedByUser) {
      // New question proposal — validate the question itself
      const activeCount = await this.questionRepo.countActiveByUserId(
        question.userId,
      );
      if (activeCount >= 3) throw new QuestionLimitExceededError();

      const validated = question.withValidated();
      await this.questionRepo.save(validated);

      const unvalidatedTx =
        await this.transactionRepo.findLatestUnvalidatedByQuestionId(
          questionId,
        );
      if (unvalidatedTx) {
        const validatedTx = unvalidatedTx.withValidated();
        await this.transactionRepo.save(validatedTx);
        return { ...validated.toProps(), currentText: validatedTx.string };
      }

      return { ...validated.toProps(), currentText: '' };
    }

    // Existing question text update proposal
    const unvalidatedTx =
      await this.transactionRepo.findLatestUnvalidatedByQuestionId(questionId);
    if (!unvalidatedTx) throw new QuestionNotPendingError(questionId);

    const validatedTx = unvalidatedTx.withValidated();
    await this.transactionRepo.save(validatedTx);

    return { ...question.toProps(), currentText: validatedTx.string };
  }
}
