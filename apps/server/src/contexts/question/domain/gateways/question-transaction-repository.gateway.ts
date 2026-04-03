import type { QuestionTransaction } from '../models/question-transaction';

export interface QuestionTransactionRepositoryGateway {
  listByQuestionId(questionId: string): Promise<QuestionTransaction[]>;
  findLatestByQuestionId(questionId: string): Promise<QuestionTransaction | null>;
  findLatestValidatedByQuestionId(questionId: string): Promise<QuestionTransaction | null>;
  findLatestUnvalidatedByQuestionId(questionId: string): Promise<QuestionTransaction | null>;
  append(transaction: QuestionTransaction): Promise<void>;
  save(transaction: QuestionTransaction): Promise<void>;
  delete(id: string): Promise<void>;
}
