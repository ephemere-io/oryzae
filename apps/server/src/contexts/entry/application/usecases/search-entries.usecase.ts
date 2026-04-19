import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway.js';
import type { EntryProps } from '../../domain/models/entry.js';

export class SearchEntriesUsecase {
  constructor(private entryRepo: EntryRepositoryGateway) {}

  async execute(
    userId: string,
    query: string,
    cursor?: string,
    limit?: number,
  ): Promise<EntryProps[]> {
    const entries = await this.entryRepo.searchByUserId(userId, query, cursor, limit);
    return entries.map((entry) => entry.toProps());
  }
}
