import type { QuestionRepositoryGateway } from '../../domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '../../domain/gateways/question-transaction-repository.gateway.js';
import type { QuestionProps } from '../../domain/models/question.js';

export class ListAllQuestionsUsecase {
  constructor(
    private questionRepo: QuestionRepositoryGateway,
    private transactionRepo: QuestionTransactionRepositoryGateway,
  ) {}

  async execute(userId: string): Promise<Array<QuestionProps & { currentText: string | null }>> {
    const questions = await this.questionRepo.listAllByUserId(userId);
    // Issue #362: 問いごとに findLatestValidatedByQuestionId を逐次呼ぶと N+1 になるため、
    // 最新 validated transaction を1クエリでまとめて取得する。
    const latestByQuestionId = await this.transactionRepo.findLatestValidatedByQuestionIds(
      questions.map((q) => q.id),
    );
    return questions.map((q) => ({
      ...q.toProps(),
      currentText: latestByQuestionId.get(q.id)?.string ?? null,
    }));
  }
}
