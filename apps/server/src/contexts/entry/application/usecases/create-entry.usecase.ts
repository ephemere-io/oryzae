import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway';
import type { BaseEntry } from '../../domain/models/entry';

interface CreateEntryInput {
  content: string;
  mediaUrls: string[];
  editorType: string;
  editorVersion: string;
  extension: Record<string, unknown>;
}

export class CreateEntryUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private snapshotRepo: EntrySnapshotRepositoryGateway,
  ) {}

  async execute(userId: string, input: CreateEntryInput): Promise<BaseEntry> {
    const now = new Date().toISOString();
    const entry: BaseEntry = {
      id: crypto.randomUUID(),
      userId,
      content: input.content,
      mediaUrls: input.mediaUrls,
      createdAt: now,
      updatedAt: now,
    };

    await this.entryRepo.save(entry);
    await this.snapshotRepo.append({
      entryId: entry.id,
      content: input.content,
      editorType: input.editorType,
      editorVersion: input.editorVersion,
      extension: input.extension,
    });

    return entry;
  }
}
