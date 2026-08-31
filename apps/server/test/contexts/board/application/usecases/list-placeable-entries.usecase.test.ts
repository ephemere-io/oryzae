import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListPlaceableEntriesUsecase } from '@/contexts/board/application/usecases/list-placeable-entries.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import { BoardCard } from '@/contexts/board/domain/models/board-card';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';

let boardCardRepo: BoardCardRepositoryGateway;
let entryRepo: EntryRepositoryGateway;
let usecase: ListPlaceableEntriesUsecase;

function entry(id: string, content: string, createdAt: string): Entry {
  return Entry.fromProps({
    id,
    userId: 'user-1',
    content,
    mediaUrls: [],
    fermentationEnabled: false,
    createdAt,
    updatedAt: createdAt,
  });
}

function entryCard(refId: string): BoardCard {
  return BoardCard.fromProps({
    id: `card-${refId}`,
    userId: 'user-1',
    cardType: 'entry',
    refId,
    dateKey: '2026-04-11',
    viewType: 'daily',
    x: 0,
    y: 0,
    rotation: 0,
    width: 340,
    height: 280,
    zIndex: 0,
    userPositioned: false,
    createdAt: '2026-04-11T00:00:00Z',
    updatedAt: '2026-04-11T00:00:00Z',
  });
}

beforeEach(() => {
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findDailyCardsByDateRange: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateRange: vi.fn().mockResolvedValue([]),
    findSoftDeletedRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findSoftDeletedByRefId: vi.fn().mockResolvedValue(null),
    restore: vi.fn().mockResolvedValue(undefined),
    findMaxZIndex: vi.fn().mockResolvedValue(-1),
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  entryRepo = {
    findById: vi.fn().mockResolvedValue(null),
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
  usecase = new ListPlaceableEntriesUsecase(entryRepo, boardCardRepo);
});

describe('ListPlaceableEntriesUsecase', () => {
  it('その日のエントリを見出しと抜粋つきで返す', async () => {
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([
      entry('e-1', '一行目\n二行目', '2026-04-11T10:00:00Z'),
    ]);

    const { entries } = await usecase.execute('user-1', '2026-04-11');

    expect(entries).toHaveLength(1);
    // 見出しは最初の非空行、抜粋は本文の先頭（盤面のカードと同じ作り方）
    expect(entries[0].title).toBe('一行目');
    expect(entries[0].preview).toBe('一行目\n二行目');
    expect(entries[0].placed).toBe(false);
  });

  it('すでに盤面にあるエントリは placed=true で返す（一覧からは消さない）', async () => {
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([
      entry('e-placed', '置いてある', '2026-04-11T10:00:00Z'),
      entry('e-free', 'まだ置いていない', '2026-04-11T11:00:00Z'),
    ]);
    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([entryCard('e-placed')]);

    const { entries } = await usecase.execute('user-1', '2026-04-11');

    const byId = (id: string) => entries.find((e) => e.id === id);
    expect(byId('e-placed')?.placed).toBe(true);
    expect(byId('e-free')?.placed).toBe(false);
  });

  it('外したエントリはまた置ける（生きているカードだけを見る）', async () => {
    // findByDateAndView は is_deleted=false で絞るので、soft delete したものは
    // ここに現れない＝候補として復活する。
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([
      entry('e-1', '一度外した', '2026-04-11T10:00:00Z'),
    ]);
    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([]);

    const { entries } = await usecase.execute('user-1', '2026-04-11');

    expect(entries[0].placed).toBe(false);
  });

  it('新しいエントリを先頭に並べる', async () => {
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([
      entry('old', '古い', '2026-04-11T09:00:00Z'),
      entry('new', '新しい', '2026-04-11T18:00:00Z'),
    ]);

    const { entries } = await usecase.execute('user-1', '2026-04-11');

    expect(entries.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('weekly では listByUserIdAndWeek を使う', async () => {
    await usecase.execute('user-1', '2026-04-11', 'weekly');

    expect(entryRepo.listByUserIdAndWeek).toHaveBeenCalledWith('user-1', '2026-04-11', 0);
    expect(entryRepo.listByUserIdAndDate).not.toHaveBeenCalled();
  });

  it('tzOffsetMinutes をエントリ取得へ透過する（ボードの日付境界バグの回帰）', async () => {
    // 元は LoadBoardUsecase の回帰テスト。日付でエントリを引く責務がこちらへ
    // 移ったので、ここで引き継いで守る。
    await usecase.execute('user-1', '2026-08-10', 'daily', -540);

    expect(entryRepo.listByUserIdAndDate).toHaveBeenCalledWith('user-1', '2026-08-10', -540);
  });

  it('カードが無いエントリだけの日でも落ちない', async () => {
    const { entries } = await usecase.execute('user-1', '2026-04-11');
    expect(entries).toEqual([]);
  });
});
