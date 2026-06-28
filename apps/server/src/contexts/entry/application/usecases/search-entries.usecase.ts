import type {
  EntryListOrder,
  EntryRepositoryGateway,
} from '../../domain/gateways/entry-repository.gateway.js';
import type { EntryProps } from '../../domain/models/entry.js';

export class SearchEntriesUsecase {
  constructor(private entryRepo: EntryRepositoryGateway) {}

  async execute(
    userId: string,
    query: string,
    cursor?: string,
    limit?: number,
    questionId?: string,
    order?: EntryListOrder,
  ): Promise<EntryProps[]> {
    const entries = await this.entryRepo.searchByUserId(
      userId,
      query,
      cursor,
      limit,
      questionId,
      order,
    );
    return entries.map((entry) => entry.toProps());
  }
}
