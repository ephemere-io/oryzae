import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway';
import type { QuestionProps } from '../../domain/models/question';
import type { QuestionTransactionProps } from '../../domain/models/question-transaction';

interface GetQuestionResult {
  question: QuestionProps;
  currentText: string | null;
  transactions: QuestionTransactionProps[];
}

export class GetQuestionUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
  ) {}

  async execute(questionId: string): Promise<GetQuestionResult | null> {
    const question = await this.questionRepo.findById(questionId);
    if (!question) return null;

    const transactions = await this.transactionRepo.listByQuestionId(questionId);
    const latestValidated = await this.transactionRepo.findLatestValidatedByQuestionId(questionId);

    return {
      question: question.toProps(),
      currentText: latestValidated?.string ?? null,
      transactions: transactions.map((tx) => tx.toProps()),
    };
  }
}
