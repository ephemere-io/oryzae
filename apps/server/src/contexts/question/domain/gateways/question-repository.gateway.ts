import type { Question } from '../models/question.js';

export interface QuestionRepositoryGateway {
  findById(id: string): Promise<Question | null>;
  listActiveByUserId(userId: string): Promise<Question[]>;
  listAllByUserId(userId: string): Promise<Question[]>;
  listPendingByUserId(userId: string): Promise<Question[]>;
  countActiveByUserId(userId: string): Promise<number>;
  save(question: Question): Promise<void>;
  delete(id: string): Promise<void>;
}
