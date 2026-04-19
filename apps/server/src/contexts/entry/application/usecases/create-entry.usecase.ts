import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway.js';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway.js';
import { Entry, type EntryProps } from '../../domain/models/entry.js';
import { EntrySnapshot } from '../../domain/models/entry-snapshot.js';
import { EntryValidationError } from '../errors/entry.errors.js';

interface CreateEntryInput {
  content: string;
  mediaUrls: string[];
  editorType: string;
  editorVersion: string;
  extension: Record<string, unknown>;
  fermentationEnabled?: boolean;
}

export class CreateEntryUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private snapshotRepo: EntrySnapshotRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(userId: string, input: CreateEntryInput): Promise<EntryProps> {
    const entryResult = Entry.create(
      {
        userId,
        content: input.content,
        mediaUrls: input.mediaUrls,
        fermentationEnabled: input.fermentationEnabled ?? false,
      },
      this.generateId,
    );
    if (!entryResult.success) {
      throw new EntryValidationError(entryResult.error.message);
    }
    const entry = entryResult.value;

    const snapshot = EntrySnapshot.create(
      {
        entryId: entry.id,
        content: input.content,
        editorType: input.editorType,
        editorVersion: input.editorVersion,
        extension: input.extension,
      },
      this.generateId,
    );

    await this.entryRepo.save(entry);
    await this.snapshotRepo.append(snapshot);

    return entry.toProps();
  }
}
