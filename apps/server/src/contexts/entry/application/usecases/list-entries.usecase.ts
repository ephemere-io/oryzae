import type {
  EntryListOrder,
  EntryMonthFilter,
  EntryRepositoryGateway,
} from '../../domain/gateways/entry-repository.gateway.js';
import type { EntryProps } from '../../domain/models/entry.js';

export class ListEntriesUsecase {
  constructor(private entryRepo: EntryRepositoryGateway) {}

  async execute(
    userId: string,
    cursor?: string,
    limit?: number,
    questionId?: string,
    order?: EntryListOrder,
    month?: EntryMonthFilter,
  ): Promise<EntryProps[]> {
    const entries = await this.entryRepo.listByUserId(
      userId,
      cursor,
      limit,
      questionId,
      order,
      month,
    );
    return entries.map((entry) => entry.toProps());
  }
}
