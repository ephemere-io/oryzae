import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetEntryUsecase } from '@/contexts/entry/application/usecases/get-entry.usecase';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-snapshot-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';
import { EntrySnapshot } from '@/contexts/entry/domain/models/entry-snapshot';

describe('GetEntryUsecase', () => {
  let entryRepo: EntryRepositoryGateway;
  let snapshotRepo: EntrySnapshotRepositoryGateway;
  let usecase: GetEntryUsecase;

  const entryProps = {
    id: 'entry-1',
    userId: 'user-1',
    content: 'Hello',
    mediaUrls: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const snapshotProps = {
    id: 'snapshot-1',
    entryId: 'entry-1',
    content: 'Hello',
    editorType: 'typetrace',
    editorVersion: '1.0.0',
    extension: {},
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
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
    usecase = new GetEntryUsecase(entryRepo, snapshotRepo);
  });

  it('Entry と latestSnapshot の両方を返す', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(Entry.fromProps(entryProps));
    vi.mocked(snapshotRepo.findLatestByEntryId).mockResolvedValue(
      EntrySnapshot.fromProps(snapshotProps),
    );

    const result = await usecase.execute('entry-1');

    expect(result).toEqual({
      entry: entryProps,
      latestSnapshot: snapshotProps,
    });
    expect(entryRepo.findById).toHaveBeenCalledWith('entry-1');
    expect(snapshotRepo.findLatestByEntryId).toHaveBeenCalledWith('entry-1');
  });

  it('Snapshot が存在しない場合 latestSnapshot は null を返す', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(Entry.fromProps(entryProps));
    vi.mocked(snapshotRepo.findLatestByEntryId).mockResolvedValue(null);

    const result = await usecase.execute('entry-1');

    expect(result).toEqual({
      entry: entryProps,
      latestSnapshot: null,
    });
  });

  it('Entry が存在しない場合 null を返す', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(null);

    const result = await usecase.execute('nonexistent');

    expect(result).toBeNull();
    expect(snapshotRepo.findLatestByEntryId).not.toHaveBeenCalled();
  });
});
