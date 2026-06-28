import type { QuestionTransaction } from '../models/question-transaction.js';

export interface QuestionTransactionRepositoryGateway {
  listByQuestionId(questionId: string): Promise<QuestionTransaction[]>;
  findLatestByQuestionId(questionId: string): Promise<QuestionTransaction | null>;
  findLatestValidatedByQuestionId(questionId: string): Promise<QuestionTransaction | null>;
  /**
   * 複数の問いについて「最新の validated transaction」をまとめて1クエリで取得する。
   * findLatestValidatedByQuestionId の N+1 を避けるためのバッチ版（Issue #362）。
   * 戻り値は questionId -> 最新 validated transaction の Map。validated が無い問いはキーを持たない。
   */
  findLatestValidatedByQuestionIds(
    questionIds: string[],
  ): Promise<Map<string, QuestionTransaction>>;
  findLatestUnvalidatedByQuestionId(questionId: string): Promise<QuestionTransaction | null>;
  append(transaction: QuestionTransaction): Promise<void>;
  save(transaction: QuestionTransaction): Promise<void>;
  delete(id: string): Promise<void>;
}
