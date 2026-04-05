import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway';
import type { QuestionProps } from '../../domain/models/question';
import { QuestionTransaction } from '../../domain/models/question-transaction';
import { QuestionNotFoundError, QuestionValidationError } from '../errors/question.errors';

interface EditQuestionInput {
  string: string;
}

export class EditQuestionUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(
    questionId: string,
    input: EditQuestionInput,
  ): Promise<QuestionProps & { currentText: string }> {
    const question = await this.questionRepo.findById(questionId);
    if (!question) throw new QuestionNotFoundError(questionId);

    const latest = await this.transactionRepo.findLatestByQuestionId(questionId);
    const nextVersion = latest ? latest.questionVersion + 1 : 1;

    const txResult = QuestionTransaction.create(
      {
        questionId,
        string: input.string,
        questionVersion: nextVersion,
        isProposedByOryzae: false,
      },
      this.generateId,
    );
    if (!txResult.success) {
      throw new QuestionValidationError(txResult.error.message);
    }

    await this.transactionRepo.append(txResult.value);

    return { ...question.toProps(), currentText: txResult.value.string };
  }
}
