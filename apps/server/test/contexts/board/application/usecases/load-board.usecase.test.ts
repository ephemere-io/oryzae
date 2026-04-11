import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadBoardUsecase } from '@/contexts/board/application/usecases/load-board.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardSnippetRepositoryGateway } from '@/contexts/board/domain/gateways/board-snippet-repository.gateway';
import { BoardCard } from '@/contexts/board/domain/models/board-card';
import { BoardSnippet } from '@/contexts/board/domain/models/board-snippet';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';

const generateId = () => 'generated-id';

let boardCardRepo: BoardCardRepositoryGateway;
let boardSnippetRepo: BoardSnippetRepositoryGateway;
let entryRepo: EntryRepositoryGateway;
let usecase: LoadBoardUsecase;

beforeEach(() => {
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
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
  entryRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    listByUserId: vi.fn().mockResolvedValue([]),
    listByUserIdAndDate: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new LoadBoardUsecase(boardCardRepo, boardSnippetRepo, entryRepo, generateId);
});

describe('LoadBoardUsecase', () => {
  it('既存カードを返す', async () => {
    const card = BoardCard.fromProps({
      id: 'card-1',
      userId: 'user-1',
      cardType: 'entry',
      refId: 'entry-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 100,
      y: 200,
      rotation: 0,
      width: 340,
      height: 280,
      zIndex: 0,
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });
    const entry = Entry.fromProps({
      id: 'entry-1',
      userId: 'user-1',
      content: 'タイトル\n本文テキスト',
      mediaUrls: [],
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    });

    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([card]);
    vi.mocked(boardCardRepo.findRefIdsByDateAndView).mockResolvedValue(['entry-1']);
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([entry]);
    vi.mocked(entryRepo.findByIds).mockResolvedValue([entry]);

    const result = await usecase.execute('user-1', '2026-04-11');

    expect(result.dateKey).toBe('2026-04-11');
    expect(result.viewType).toBe('daily');
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].id).toBe('card-1');
    expect(result.cards[0].content).toEqual({
      title: 'タイトル',
      preview: 'タイトル\n本文テキスト',
      createdAt: '2026-04-11T10:00:00Z',
    });
  });

  it('カード未作成のエントリを自動追加する', async () => {
    const entry = Entry.fromProps({
      id: 'entry-new',
      userId: 'user-1',
      content: '新しいエントリ',
      mediaUrls: [],
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    });

    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([entry]);
    vi.mocked(entryRepo.findByIds).mockResolvedValue([entry]);

    const result = await usecase.execute('user-1', '2026-04-11');

    expect(boardCardRepo.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ refId: 'entry-new' })]),
    );
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].cardType).toBe('entry');
  });

  it('既にカードがあるエントリは重複追加しない', async () => {
    const entry = Entry.fromProps({
      id: 'entry-1',
      userId: 'user-1',
      content: '既存',
      mediaUrls: [],
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    });

    vi.mocked(boardCardRepo.findRefIdsByDateAndView).mockResolvedValue(['entry-1']);
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([entry]);

    await usecase.execute('user-1', '2026-04-11');

    expect(boardCardRepo.saveMany).not.toHaveBeenCalled();
  });

  it('snippet カードのコンテンツを hydrate する', async () => {
    const card = BoardCard.fromProps({
      id: 'card-s1',
      userId: 'user-1',
      cardType: 'snippet',
      refId: 'snippet-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 500,
      y: 200,
      rotation: 2,
      width: 260,
      height: 150,
      zIndex: 1,
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });
    const snippet = BoardSnippet.fromProps({
      id: 'snippet-1',
      userId: 'user-1',
      text: '重要な気づき',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });

    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([card]);
    vi.mocked(boardSnippetRepo.findByIds).mockResolvedValue([snippet]);

    const result = await usecase.execute('user-1', '2026-04-11');

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].content).toEqual({ text: '重要な気づき' });
  });
});
