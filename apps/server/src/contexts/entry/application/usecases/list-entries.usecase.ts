import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway';
import type { BaseEntry } from '../../domain/models/entry';

export class ListEntriesUsecase {
  constructor(private entryRepo: EntryRepositoryGateway) {}

  async execute(
    userId: string,
    cursor?: string,
    limit?: number,
  ): Promise<BaseEntry[]> {
    return this.entryRepo.listByUserId(userId, cursor, limit);
  }
}
