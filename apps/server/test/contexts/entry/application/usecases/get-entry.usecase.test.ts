import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetEntryUsecase } from '@/contexts/entry/application/usecases/get-entry.usecase';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import type { EntrySnapshotRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-snapshot-repository.gateway';
import type { EntryStorageGateway } from '@/contexts/entry/domain/gateways/entry-storage.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';
import { EntrySnapshot } from '@/contexts/entry/domain/models/entry-snapshot';

describe('GetEntryUsecase', () => {
  let entryRepo: EntryRepositoryGateway;
  let snapshotRepo: EntrySnapshotRepositoryGateway;
  let entryStorage: EntryStorageGateway;
  let usecase: GetEntryUsecase;

  const entryProps = {
    id: 'entry-1',
    userId: 'user-1',
    content: 'Hello',
    mediaUrls: [],
    fermentationEnabled: false,
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
    entryStorage = {
      upload: vi.fn().mockResolvedValue(''),
      getSignedUrl: vi.fn().mockResolvedValue(''),
      getSignedUrls: vi.fn().mockResolvedValue(new Map()),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    usecase = new GetEntryUsecase(entryRepo, snapshotRepo, entryStorage);
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
      mediaSignedUrls: [],
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
      mediaSignedUrls: [],
    });
  });

  // バケットは private なので、保存されているパスを都度署名して返す（00023 / #504）。
  it('保存されたパスを署名して mediaSignedUrls に並べる（元の並び順を保つ）', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(
      Entry.fromProps({ ...entryProps, mediaUrls: ['user-1/a.jpg', 'user-1/b.jpg'] }),
    );
    vi.mocked(entryStorage.getSignedUrls).mockResolvedValue(
      new Map([
        ['user-1/b.jpg', 'https://cdn.example/b?token=2'],
        ['user-1/a.jpg', 'https://cdn.example/a?token=1'],
      ]),
    );

    const result = await usecase.execute('entry-1');

    expect(entryStorage.getSignedUrls).toHaveBeenCalledWith(['user-1/a.jpg', 'user-1/b.jpg']);
    expect(result?.mediaSignedUrls).toEqual([
      'https://cdn.example/a?token=1',
      'https://cdn.example/b?token=2',
    ]);
    // 保存側はパスのまま（署名 URL を保存すると失効して壊れる）。
    expect(result?.entry.mediaUrls).toEqual(['user-1/a.jpg', 'user-1/b.jpg']);
  });

  // 詰めると index がずれ、クライアントの「n 番目を削除」が別の写真を消してしまう。
  // 空文字で穴を維持し、長さは必ず mediaUrls と一致させる。
  it('署名できなかった写真は空文字で埋め、並びと長さを保つ', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(
      Entry.fromProps({
        ...entryProps,
        mediaUrls: ['user-1/a.jpg', 'user-1/gone.jpg', 'user-1/c.jpg'],
      }),
    );
    vi.mocked(entryStorage.getSignedUrls).mockResolvedValue(
      new Map([
        ['user-1/a.jpg', 'https://cdn.example/a?token=1'],
        ['user-1/c.jpg', 'https://cdn.example/c?token=3'],
      ]),
    );

    const result = await usecase.execute('entry-1');

    expect(result?.mediaSignedUrls).toEqual([
      'https://cdn.example/a?token=1',
      '',
      'https://cdn.example/c?token=3',
    ]);
    expect(result?.mediaSignedUrls).toHaveLength(result?.entry.mediaUrls.length ?? 0);
  });

  it('全部署名に失敗しても長さは保つ', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(
      Entry.fromProps({ ...entryProps, mediaUrls: ['user-1/a.jpg', 'user-1/b.jpg'] }),
    );
    vi.mocked(entryStorage.getSignedUrls).mockResolvedValue(new Map());

    const result = await usecase.execute('entry-1');

    expect(result?.mediaSignedUrls).toEqual(['', '']);
  });

  it('Entry が存在しない場合 null を返す', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(null);

    const result = await usecase.execute('nonexistent');

    expect(result).toBeNull();
    expect(snapshotRepo.findLatestByEntryId).not.toHaveBeenCalled();
  });
});
