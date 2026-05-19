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
    fermentationEnabled: false,
    effects: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });

  beforeEach(() => {
    entryRepo = {
      findById: vi.fn().mockResolvedValue(existingEntry),
      findByIds: vi.fn().mockResolvedValue([]),
      listByUserId: vi.fn().mockResolvedValue([]),
      listByUserIdAndDate: vi.fn().mockResolvedValue([]),
      listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
      listFermentationEnabledByUserIdSince: vi.fn().mockResolvedValue([]),
      countCharsByUserIdSince: vi.fn().mockResolvedValue(0),
      listByUserIdAndWeek: vi.fn().mockResolvedValue([]),
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
    expect(result.fermentationEnabled).toBe(false);
    expect(entryRepo.save).toHaveBeenCalledTimes(1);
    expect(snapshotRepo.append).toHaveBeenCalledTimes(1);
  });

  it('fermentationEnabled 未指定時は既存値を保持する', async () => {
    const pickled = Entry.fromProps({
      id: 'entry-1',
      userId: 'user-1',
      content: 'original',
      mediaUrls: [],
      fermentationEnabled: true,
      effects: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    vi.mocked(entryRepo.findById).mockResolvedValue(pickled);

    const result = await usecase.execute('entry-1', {
      content: 'updated',
      mediaUrls: [],
      editorType: 'minimal',
      editorVersion: '1.0.0',
      extension: {},
    });

    expect(result.fermentationEnabled).toBe(true);
  });

  it('fermentationEnabled=true 指定時は true に更新する', async () => {
    const result = await usecase.execute('entry-1', {
      content: 'updated',
      mediaUrls: [],
      editorType: 'minimal',
      editorVersion: '1.0.0',
      extension: {},
      fermentationEnabled: true,
    });

    expect(result.fermentationEnabled).toBe(true);
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

  it('effects を渡すと差し替わる', async () => {
    const result = await usecase.execute('entry-1', {
      content: 'updated',
      mediaUrls: [],
      editorType: 'minimal',
      editorVersion: '1.0.0',
      extension: {},
      effects: {
        version: 1,
        eraserTraces: [{ rx: 0, ry: 0, w: 1, h: 1, chars: ['x'], intensity: 0.1, seed: 1 }],
      },
    });
    expect(result.effects?.eraserTraces).toHaveLength(1);
  });

  it('effects 未指定なら既存の effects を維持する', async () => {
    const withEffects = Entry.fromProps({
      id: 'entry-1',
      userId: 'user-1',
      content: 'original',
      mediaUrls: [],
      fermentationEnabled: false,
      effects: { version: 1, textSpans: [] },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    vi.mocked(entryRepo.findById).mockResolvedValue(withEffects);

    const result = await usecase.execute('entry-1', {
      content: 'updated',
      mediaUrls: [],
      editorType: 'minimal',
      editorVersion: '1.0.0',
      extension: {},
    });
    expect(result.effects).toEqual({ version: 1, textSpans: [] });
  });

  it('effects=null 指定で既存 effects をクリアできる', async () => {
    const withEffects = Entry.fromProps({
      id: 'entry-1',
      userId: 'user-1',
      content: 'original',
      mediaUrls: [],
      fermentationEnabled: false,
      effects: { version: 1, textSpans: [] },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    vi.mocked(entryRepo.findById).mockResolvedValue(withEffects);

    const result = await usecase.execute('entry-1', {
      content: 'updated',
      mediaUrls: [],
      editorType: 'minimal',
      editorVersion: '1.0.0',
      extension: {},
      effects: null,
    });
    expect(result.effects).toBeNull();
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
