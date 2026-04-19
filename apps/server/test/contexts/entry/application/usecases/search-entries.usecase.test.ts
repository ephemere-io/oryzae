import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchEntriesUsecase } from '@/contexts/entry/application/usecases/search-entries.usecase';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';

describe('SearchEntriesUsecase', () => {
  let entryRepo: EntryRepositoryGateway;
  let usecase: SearchEntriesUsecase;

  const entryProps1 = {
    id: 'entry-1',
    userId: 'user-1',
    content: '今日は良い天気でした',
    mediaUrls: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const entryProps2 = {
    id: 'entry-2',
    userId: 'user-1',
    content: '天気が悪くて外に出られなかった',
    mediaUrls: [],
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    entryRepo = {
      findById: vi.fn().mockResolvedValue(null),
      findByIds: vi.fn().mockResolvedValue([]),
      listByUserId: vi.fn().mockResolvedValue([]),
      listByUserIdAndDate: vi.fn().mockResolvedValue([]),
      listByUserIdAndWeek: vi.fn().mockResolvedValue([]),
      searchByUserId: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    usecase = new SearchEntriesUsecase(entryRepo);
  });

  it('検索クエリに一致する Entry の Props 配列を返す', async () => {
    vi.mocked(entryRepo.searchByUserId).mockResolvedValue([
      Entry.fromProps(entryProps1),
      Entry.fromProps(entryProps2),
    ]);

    const result = await usecase.execute('user-1', '天気');

    expect(result).toEqual([entryProps1, entryProps2]);
    expect(entryRepo.searchByUserId).toHaveBeenCalledWith('user-1', '天気', undefined, undefined);
  });

  it('一致するエントリがない場合は空配列を返す', async () => {
    vi.mocked(entryRepo.searchByUserId).mockResolvedValue([]);

    const result = await usecase.execute('user-1', '存在しないキーワード');

    expect(result).toEqual([]);
  });

  it('cursor と limit を repo に渡す', async () => {
    vi.mocked(entryRepo.searchByUserId).mockResolvedValue([Entry.fromProps(entryProps2)]);

    await usecase.execute('user-1', '天気', '2026-01-01T00:00:00.000Z', 10);

    expect(entryRepo.searchByUserId).toHaveBeenCalledWith(
      'user-1',
      '天気',
      '2026-01-01T00:00:00.000Z',
      10,
    );
  });
});
