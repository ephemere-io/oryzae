import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway';
import { CreateEntryUsecase } from './create-entry.usecase';

describe('CreateEntryUsecase', () => {
  let entryRepo: EntryRepositoryGateway;
  let snapshotRepo: EntrySnapshotRepositoryGateway;
  let usecase: CreateEntryUsecase;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;
    entryRepo = {
      findById: vi.fn().mockResolvedValue(null),
      listByUserId: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    snapshotRepo = {
      append: vi.fn().mockResolvedValue(undefined),
      findLatestByEntryId: vi.fn().mockResolvedValue(null),
    };
    usecase = new CreateEntryUsecase(entryRepo, snapshotRepo, () => `id-${++idCounter}`);
  });

  it('Entry と Snapshot を作成して保存する', async () => {
    const result = await usecase.execute('user-1', {
      content: 'Hello',
      mediaUrls: [],
      editorType: 'typetrace',
      editorVersion: '1.0.0',
      extension: {},
    });

    expect(result.id).toBe('id-1');
    expect(result.content).toBe('Hello');
    expect(result.userId).toBe('user-1');
    expect(entryRepo.save).toHaveBeenCalledTimes(1);
    expect(snapshotRepo.append).toHaveBeenCalledTimes(1);
  });

  it('content が空文字なら EntryValidationError を throw する', async () => {
    await expect(
      usecase.execute('user-1', {
        content: '',
        mediaUrls: [],
        editorType: 'typetrace',
        editorVersion: '1.0.0',
        extension: {},
      }),
    ).rejects.toThrow('Content must not be empty');

    expect(entryRepo.save).not.toHaveBeenCalled();
    expect(snapshotRepo.append).not.toHaveBeenCalled();
  });
});
