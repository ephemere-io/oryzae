import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway';
import type { EntryProps } from '../../domain/models/entry';
import type { EntrySnapshotProps } from '../../domain/models/entry-snapshot';

interface GetEntryResult {
  entry: EntryProps;
  latestSnapshot: EntrySnapshotProps | null;
}

export class GetEntryUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private snapshotRepo: EntrySnapshotRepositoryGateway,
  ) {}

  async execute(entryId: string): Promise<GetEntryResult | null> {
    const entry = await this.entryRepo.findById(entryId);
    if (!entry) return null;

    const latestSnapshot = await this.snapshotRepo.findLatestByEntryId(entryId);
    return {
      entry: entry.toProps(),
      latestSnapshot: latestSnapshot?.toProps() ?? null,
    };
  }
}
