import type { BaseEntry } from '../models/entry';

export interface EntryRepositoryGateway {
  findById(id: string): Promise<BaseEntry | null>;
  listByUserId(
    userId: string,
    cursor?: string,
    limit?: number,
  ): Promise<BaseEntry[]>;
  save(entry: BaseEntry): Promise<void>;
  delete(id: string): Promise<void>;
}
