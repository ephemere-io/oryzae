import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway';
import type { EntryProps } from '../../domain/models/entry';
import { EntrySnapshot } from '../../domain/models/entry-snapshot';
import {
  EntryNotFoundError,
  EntryValidationError,
} from '../errors/entry.errors';

interface UpdateEntryInput {
  content: string;
  mediaUrls: string[];
  editorType: string;
  editorVersion: string;
  extension: Record<string, unknown>;
}

export class UpdateEntryUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private snapshotRepo: EntrySnapshotRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(
    entryId: string,
    input: UpdateEntryInput,
  ): Promise<EntryProps> {
    const existing = await this.entryRepo.findById(entryId);
    if (!existing) throw new EntryNotFoundError(entryId);

    const updatedResult = existing.withContent(
      input.content,
      input.mediaUrls,
    );
    if (!updatedResult.success) {
      throw new EntryValidationError(updatedResult.error.message);
    }
    const updated = updatedResult.value;

    const snapshot = EntrySnapshot.create(
      {
        entryId,
        content: input.content,
        editorType: input.editorType,
        editorVersion: input.editorVersion,
        extension: input.extension,
      },
      this.generateId,
    );

    await this.entryRepo.save(updated);
    await this.snapshotRepo.append(snapshot);

    return updated.toProps();
  }
}
