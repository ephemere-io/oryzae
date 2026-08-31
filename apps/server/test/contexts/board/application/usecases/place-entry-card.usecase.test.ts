import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardEntryNotFoundError } from '@/contexts/board/application/errors/board.errors';
import { PlaceEntryCardUsecase } from '@/contexts/board/application/usecases/place-entry-card.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import { BoardCard } from '@/contexts/board/domain/models/board-card';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';

const generateId = () => 'generated-id';

let boardCardRepo: BoardCardRepositoryGateway;
let entryRepo: EntryRepositoryGateway;
let usecase: PlaceEntryCardUsecase;

function entry(id: string, userId: string): Entry {
  return Entry.fromProps({
    id,
    userId,
    content: '本文',
    mediaUrls: [],
    fermentationEnabled: false,
    createdAt: '2026-04-11T10:00:00Z',
    updatedAt: '2026-04-11T10:00:00Z',
  });
}

beforeEach(() => {
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findDailyCardsByDateRange: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateRange: vi.fn().mockResolvedValue([]),
    findSoftDeletedRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findMaxZIndex: vi.fn().mockResolvedValue(4),
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  entryRepo = {
    findById: vi.fn().mockResolvedValue(entry('e-1', 'user-1')),
    findByIds: vi.fn().mockResolvedValue([]),
    listByUserId: vi.fn().mockResolvedValue([]),
    listByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdSince: vi.fn().mockResolvedValue([]),
    countCharsByUserIdSince: vi.fn().mockResolvedValue(0),
    listByUserIdAndWeek: vi.fn().mockResolvedValue([]),
    searchByUserId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new PlaceEntryCardUsecase(entryRepo, boardCardRepo, generateId);
});

describe('PlaceEntryCardUsecase', () => {
  it('選んだ日記をカードとして置く', async () => {
    const result = await usecase.execute('user-1', { entryId: 'e-1', dateKey: '2026-04-11' });

    expect(boardCardRepo.saveMany).toHaveBeenCalledWith([
      expect.objectContaining({ cardType: 'entry', refId: 'e-1' }),
    ]);
    expect(result.refId).toBe('e-1');
  });

  it('既存カードより手前に置く', async () => {
    const result = await usecase.execute('user-1', { entryId: 'e-1', dateKey: '2026-04-11' });

    // findMaxZIndex が 4 を返すので 5
    expect(result.zIndex).toBe(5);
  });

  it('他人の日記は置けない', async () => {
    // RLS でも守られるが、盤面のカードは自分の行として作れてしまうので
    // usecase 側でも持ち主を確かめる。
    vi.mocked(entryRepo.findById).mockResolvedValue(entry('e-someone', 'user-2'));

    await expect(
      usecase.execute('user-1', { entryId: 'e-someone', dateKey: '2026-04-11' }),
    ).rejects.toThrow(BoardEntryNotFoundError);
    expect(boardCardRepo.saveMany).not.toHaveBeenCalled();
  });

  it('存在しない日記は置けない', async () => {
    vi.mocked(entryRepo.findById).mockResolvedValue(null);

    await expect(
      usecase.execute('user-1', { entryId: 'missing', dateKey: '2026-04-11' }),
    ).rejects.toThrow(BoardEntryNotFoundError);
  });

  it('同じ日記を二重に置かず、既存のカードを返す', async () => {
    const existing = BoardCard.fromProps({
      id: 'card-existing',
      userId: 'user-1',
      cardType: 'entry',
      refId: 'e-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 100,
      y: 200,
      rotation: 1.5,
      width: 340,
      height: 280,
      zIndex: 2,
      userPositioned: true,
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });
    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([existing]);

    const result = await usecase.execute('user-1', { entryId: 'e-1', dateKey: '2026-04-11' });

    expect(boardCardRepo.saveMany).not.toHaveBeenCalled();
    // 位置も動かさない（利用者が置いた場所を勝手に変えない）
    expect(result).toMatchObject({ cardId: 'card-existing', x: 100, y: 200, zIndex: 2 });
  });

  it('viewType を渡さなければ daily に置く', async () => {
    await usecase.execute('user-1', { entryId: 'e-1', dateKey: '2026-04-11' });

    expect(boardCardRepo.saveMany).toHaveBeenCalledWith([
      expect.objectContaining({ viewType: 'daily' }),
    ]);
  });

  it('weekly を指定すれば weekly に置く', async () => {
    await usecase.execute('user-1', {
      entryId: 'e-1',
      dateKey: '2026-04-11',
      viewType: 'weekly',
    });

    expect(boardCardRepo.saveMany).toHaveBeenCalledWith([
      expect.objectContaining({ viewType: 'weekly' }),
    ]);
  });
});
