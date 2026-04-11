import type { Entry } from '../models/entry.js';

export interface EntryRepositoryGateway {
  findById(id: string): Promise<Entry | null>;
  findByIds(ids: string[]): Promise<Entry[]>;
  listByUserId(userId: string, cursor?: string, limit?: number): Promise<Entry[]>;
  listByUserIdAndDate(userId: string, dateKey: string): Promise<Entry[]>;
  listByUserIdAndWeek(userId: string, dateKey: string): Promise<Entry[]>;
  save(entry: Entry): Promise<void>;
  delete(id: string): Promise<void>;
}
