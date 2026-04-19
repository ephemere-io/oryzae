import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateEntryUsecase } from '@/contexts/entry/application/usecases/create-entry.usecase';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-snapshot-repository.gateway';

describe('CreateEntryUsecase', () => {
  let entryRepo: EntryRepositoryGateway;
  let snapshotRepo: EntrySnapshotRepositoryGateway;
  let usecase: CreateEntryUsecase;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;
    entryRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByIds: vi.fn().mockResolvedValue([]),
      listByUserId: vi.fn().mockResolvedValue([]),
      listByUserIdAndDate: vi.fn().mockResolvedValue([]),
      listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
      listByUserIdAndWeek: vi.fn().mockResolvedValue([]),
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
    expect(result.fermentationEnabled).toBe(false);
    expect(entryRepo.save).toHaveBeenCalledTimes(1);
    expect(snapshotRepo.append).toHaveBeenCalledTimes(1);
  });

  it('fermentationEnabled=true で作成できる', async () => {
    const result = await usecase.execute('user-1', {
      content: 'Hello',
      mediaUrls: [],
      editorType: 'typetrace',
      editorVersion: '1.0.0',
      extension: {},
      fermentationEnabled: true,
    });

    expect(result.fermentationEnabled).toBe(true);
  });

  it('fermentationEnabled 未指定時は false', async () => {
    const result = await usecase.execute('user-1', {
      content: 'Hello',
      mediaUrls: [],
      editorType: 'typetrace',
      editorVersion: '1.0.0',
      extension: {},
    });

    expect(result.fermentationEnabled).toBe(false);
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
