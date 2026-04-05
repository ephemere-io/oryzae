import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateEntryUsecase } from '@/contexts/entry/application/usecases/update-entry.usecase';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-snapshot-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';

describe('UpdateEntryUsecase', () => {
  let entryRepo: EntryRepositoryGateway;
  let snapshotRepo: EntrySnapshotRepositoryGateway;
  let usecase: UpdateEntryUsecase;

  const existingEntry = Entry.fromProps({
    id: 'entry-1',
    userId: 'user-1',
    content: 'original',
    mediaUrls: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });

  beforeEach(() => {
    entryRepo = {
      findById: vi.fn().mockResolvedValue(existingEntry),
      listByUserId: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    snapshotRepo = {
      append: vi.fn().mockResolvedValue(undefined),
      findLatestByEntryId: vi.fn().mockResolvedValue(null),
    };
    usecase = new UpdateEntryUsecase(entryRepo, snapshotRepo, () => 'snap-id');
  });

  it('Entry を更新し Snapshot を追記する', async () => {
    const result = await usecase.execute('entry-1', {
      content: 'updated',
      mediaUrls: ['url1'],
      editorType: 'minimal',
      editorVersion: '1.0.0',
      extension: {},
    });

    expect(result.content).toBe('updated');
    expect(result.mediaUrls).toEqual(['url1']);
    expect(entryRepo.save).toHaveBeenCalledTimes(1);
    expect(snapshotRepo.append).toHaveBeenCalledTimes(1);
  });

  it('存在しない Entry なら EntryNotFoundError を throw する', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(null);

    await expect(
      usecase.execute('nonexistent', {
        content: 'test',
        mediaUrls: [],
        editorType: 'typetrace',
        editorVersion: '1.0.0',
        extension: {},
      }),
    ).rejects.toThrow('Entry not found');

    expect(entryRepo.save).not.toHaveBeenCalled();
  });

  it('content が空文字なら EntryValidationError を throw する', async () => {
    await expect(
      usecase.execute('entry-1', {
        content: '',
        mediaUrls: [],
        editorType: 'typetrace',
        editorVersion: '1.0.0',
        extension: {},
      }),
    ).rejects.toThrow('Content must not be empty');

    expect(entryRepo.save).not.toHaveBeenCalled();
  });
});
