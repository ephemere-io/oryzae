import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway';
import { Question, type QuestionProps } from '../../domain/models/question';
import { QuestionTransaction } from '../../domain/models/question-transaction';
import { QuestionLimitExceededError, QuestionValidationError } from '../errors/question.errors';

interface CreateQuestionInput {
  string: string;
}

export class CreateQuestionUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(
    userId: string,
    input: CreateQuestionInput,
  ): Promise<QuestionProps & { currentText: string }> {
    const activeCount = await this.questionRepo.countActiveByUserId(userId);
    if (activeCount >= 3) throw new QuestionLimitExceededError();

    const question = Question.create({ userId, isProposedByOryzae: false }, this.generateId);

    const txResult = QuestionTransaction.create(
      {
        questionId: question.id,
        string: input.string,
        questionVersion: 1,
        isProposedByOryzae: false,
      },
      this.generateId,
    );
    if (!txResult.success) {
      throw new QuestionValidationError(txResult.error.message);
    }

    await this.questionRepo.save(question);
    await this.transactionRepo.append(txResult.value);

    return { ...question.toProps(), currentText: txResult.value.string };
  }
}
