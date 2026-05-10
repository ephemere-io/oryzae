import type { Question } from '../models/question.js';

export interface JarPositionUpdate {
  id: string;
  jarX: number;
  jarY: number;
}

export interface QuestionRepositoryGateway {
  findById(id: string): Promise<Question | null>;
  listActiveByUserId(userId: string): Promise<Question[]>;
  listAllByUserId(userId: string): Promise<Question[]>;
  listPendingByUserId(userId: string): Promise<Question[]>;
  countActiveByUserId(userId: string): Promise<number>;
  save(question: Question): Promise<void>;
  delete(id: string): Promise<void>;
  /**
   * Batch-update Jar view positions. Cross-user writes are blocked by RLS
   * (the supabase client is user-scoped, see route handlers).
   */
  updateJarPositions(updates: JarPositionUpdate[]): Promise<void>;
}
