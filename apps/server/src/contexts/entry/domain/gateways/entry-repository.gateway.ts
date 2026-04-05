import type { Entry } from '../models/entry';

export interface EntryRepositoryGateway {
  findById(id: string): Promise<Entry | null>;
  listByUserId(userId: string, cursor?: string, limit?: number): Promise<Entry[]>;
  save(entry: Entry): Promise<void>;
  delete(id: string): Promise<void>;
}
