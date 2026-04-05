import type { Entry } from '../models/entry.js';

export interface EntryRepositoryGateway {
  findById(id: string): Promise<Entry | null>;
  listByUserId(userId: string, cursor?: string, limit?: number): Promise<Entry[]>;
  save(entry: Entry): Promise<void>;
  delete(id: string): Promise<void>;
}
