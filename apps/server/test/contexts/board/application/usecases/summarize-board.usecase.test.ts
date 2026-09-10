import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SummarizeBoardUsecase } from '@/contexts/board/application/usecases/summarize-board.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardPhotoRepositoryGateway } from '@/contexts/board/domain/gateways/board-photo-repository.gateway';
import type { BoardSnippetRepositoryGateway } from '@/contexts/board/domain/gateways/board-snippet-repository.gateway';
import type { BoardStorageGateway } from '@/contexts/board/domain/gateways/board-storage.gateway';
import { BoardCard } from '@/contexts/board/domain/models/board-card';
import { BoardSnippet } from '@/contexts/board/domain/models/board-snippet';

let boardCardRepo: BoardCardRepositoryGateway;
let boardSnippetRepo: BoardSnippetRepositoryGateway;
let boardPhotoRepo: BoardPhotoRepositoryGateway;
let boardStorage: BoardStorageGateway;
let usecase: SummarizeBoardUsecase;

function card(id: string, refId: string, viewType: 'daily' | 'weekly'): BoardCard {
  return BoardCard.fromProps({
    id,
    userId: 'user-1',
    cardType: 'snippet',
    refId,
    dateKey: '2026-09-11',
    viewType,
    x: 0,
    y: 0,
    rotation: 0,
    width: 200,
    height: 120,
    zIndex: 0,
    userPositioned: false,
    createdAt: '2026-09-11T00:00:00Z',
    updatedAt: '2026-09-11T00:00:00Z',
  });
}

function snippet(id: string): BoardSnippet {
  return BoardSnippet.fromProps({
    id,
    userId: 'user-1',
    text: `本文 ${id}`,
    createdAt: '2026-09-11T00:00:00Z',
    updatedAt: '2026-09-11T00:00:00Z',
  });
}

beforeEach(() => {
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findDailyCardsByDateRange: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateRange: vi.fn().mockResolvedValue([]),
    findSoftDeletedRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findMaxZIndex: vi.fn().mockResolvedValue(-1),
    countPinnedByType: vi.fn().mockResolvedValue({ snippet: 0, photo: 0 }),
    findRecentByUserId: vi.fn().mockResolvedValue([]),
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  boardSnippetRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  boardPhotoRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  boardStorage = {
    upload: vi.fn().mockResolvedValue('path'),
    getSignedUrl: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
    getSignedUrls: vi.fn().mockResolvedValue(new Map()),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new SummarizeBoardUsecase(
    boardCardRepo,
    boardSnippetRepo,
    boardPhotoRepo,
    boardStorage,
  );
});

describe('SummarizeBoardUsecase', () => {
  it('種類ごとの数を返し、総数はその和になる', async () => {
    boardCardRepo.countPinnedByType = vi.fn().mockResolvedValue({ snippet: 12, photo: 3 });

    const summary = await usecase.execute('user-1', 30);

    expect(summary).toMatchObject({ total: 15, snippets: 12, photos: 3 });
    expect(boardCardRepo.countPinnedByType).toHaveBeenCalledWith('user-1');
  });

  it('同じ付箋が daily と weekly の両方にあっても、壁には 1 枚だけ出す', async () => {
    boardCardRepo.findRecentByUserId = vi
      .fn()
      .mockResolvedValue([
        card('card-daily', 'snippet-1', 'daily'),
        card('card-weekly', 'snippet-1', 'weekly'),
      ]);
    boardSnippetRepo.findByIds = vi.fn().mockResolvedValue([snippet('snippet-1')]);

    const summary = await usecase.execute('user-1', 30);

    expect(summary.cards).toHaveLength(1);
    expect(summary.cards[0]?.refId).toBe('snippet-1');
  });

  it('畳むぶん多めに取る（上限ちょうどだと重複の多い人の壁が薄くなる）', async () => {
    await usecase.execute('user-1', 30);

    expect(boardCardRepo.findRecentByUserId).toHaveBeenCalledWith('user-1', 60);
  });

  it('何も貼っていなければ 0 と空の壁', async () => {
    const summary = await usecase.execute('user-1', 30);

    expect(summary).toEqual({ total: 0, snippets: 0, photos: 0, cards: [] });
  });
});
