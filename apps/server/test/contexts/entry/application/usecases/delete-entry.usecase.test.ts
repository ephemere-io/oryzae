import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryNotFoundError } from '@/contexts/entry/application/errors/entry.errors';
import { DeleteEntryUsecase } from '@/contexts/entry/application/usecases/delete-entry.usecase';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';

describe('DeleteEntryUsecase', () => {
  let entryRepo: EntryRepositoryGateway;
  let usecase: DeleteEntryUsecase;

  const entryProps = {
    id: 'entry-1',
    userId: 'user-1',
    content: 'Hello',
    mediaUrls: [],
    fermentationEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    usecase = new DeleteEntryUsecase(entryRepo);
  });

  it('既存の Entry を削除する', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(Entry.fromProps(entryProps));

    await usecase.execute('entry-1');

    expect(entryRepo.findById).toHaveBeenCalledWith('entry-1');
    expect(entryRepo.delete).toHaveBeenCalledWith('entry-1');
    expect(entryRepo.delete).toHaveBeenCalledTimes(1);
  });

  it('存在しない Entry の場合 EntryNotFoundError を throw する', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(null);

    await expect(usecase.execute('nonexistent')).rejects.toThrow(EntryNotFoundError);

    expect(entryRepo.findById).toHaveBeenCalledWith('nonexistent');
    expect(entryRepo.delete).not.toHaveBeenCalled();
  });
});
