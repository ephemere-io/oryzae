import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway';
import type { BaseEntry } from '../../domain/models/entry';
import { EntryNotFoundError } from '../errors/entry.errors';

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
  ) {}

  async execute(
    entryId: string,
    input: UpdateEntryInput,
  ): Promise<BaseEntry> {
    const existing = await this.entryRepo.findById(entryId);
    if (!existing) throw new EntryNotFoundError(entryId);

    const updated: BaseEntry = {
      ...existing,
      content: input.content,
      mediaUrls: input.mediaUrls,
      updatedAt: new Date().toISOString(),
    };

    await this.entryRepo.save(updated);
    await this.snapshotRepo.append({
      entryId,
      content: input.content,
      editorType: input.editorType,
      editorVersion: input.editorVersion,
      extension: input.extension,
    });

    return updated;
  }
}
