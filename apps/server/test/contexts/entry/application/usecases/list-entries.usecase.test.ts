import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListEntriesUsecase } from '@/contexts/entry/application/usecases/list-entries.usecase';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';

describe('ListEntriesUsecase', () => {
  let entryRepo: EntryRepositoryGateway;
  let usecase: ListEntriesUsecase;

  const entryProps1 = {
    id: 'entry-1',
    userId: 'user-1',
    content: 'First entry',
    mediaUrls: [],
    fermentationEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const entryProps2 = {
    id: 'entry-2',
    userId: 'user-1',
    content: 'Second entry',
    mediaUrls: ['https://example.com/image.png'],
    fermentationEnabled: true,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
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
    usecase = new ListEntriesUsecase(entryRepo);
  });

  it('Entry の Props 配列を返す', async () => {
    vi.mocked(entryRepo.listByUserId).mockResolvedValue([
      Entry.fromProps(entryProps1),
      Entry.fromProps(entryProps2),
    ]);

    const result = await usecase.execute('user-1');

    expect(result).toEqual([entryProps1, entryProps2]);
    expect(entryRepo.listByUserId).toHaveBeenCalledWith('user-1', undefined, undefined);
  });

  it('Entry が存在しない場合は空配列を返す', async () => {
    vi.mocked(entryRepo.listByUserId).mockResolvedValue([]);

    const result = await usecase.execute('user-1');

    expect(result).toEqual([]);
  });

  it('cursor と limit を repo に渡す', async () => {
    vi.mocked(entryRepo.listByUserId).mockResolvedValue([Entry.fromProps(entryProps2)]);

    await usecase.execute('user-1', 'entry-1', 10);

    expect(entryRepo.listByUserId).toHaveBeenCalledWith('user-1', 'entry-1', 10);
  });
});
