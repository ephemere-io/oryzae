import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadBoardUsecase } from '@/contexts/board/application/usecases/load-board.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardPhotoRepositoryGateway } from '@/contexts/board/domain/gateways/board-photo-repository.gateway';
import type { BoardSnippetRepositoryGateway } from '@/contexts/board/domain/gateways/board-snippet-repository.gateway';
import type { BoardStorageGateway } from '@/contexts/board/domain/gateways/board-storage.gateway';
import { BoardCard } from '@/contexts/board/domain/models/board-card';
import { BoardPhoto } from '@/contexts/board/domain/models/board-photo';
import { BoardSnippet } from '@/contexts/board/domain/models/board-snippet';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';

const generateId = () => 'generated-id';

let boardCardRepo: BoardCardRepositoryGateway;
let boardSnippetRepo: BoardSnippetRepositoryGateway;
let boardPhotoRepo: BoardPhotoRepositoryGateway;
let boardStorage: BoardStorageGateway;
let entryRepo: EntryRepositoryGateway;
let usecase: LoadBoardUsecase;

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
    listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdSince: vi.fn().mockResolvedValue([]),
    countCharsByUserIdSince: vi.fn().mockResolvedValue(0),
    listByUserIdAndWeek: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
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
    getSignedUrls: vi
      .fn()
      .mockImplementation(
        async (paths: string[]) =>
          new Map(paths.map((path) => [path, `https://example.com/signed/${path}`])),
      ),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new LoadBoardUsecase(
    boardCardRepo,
    boardSnippetRepo,
    boardPhotoRepo,
    boardStorage,
    entryRepo,
    generateId,
  );
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
      fermentationEnabled: false,
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
      // 見出しに使った1行目は本文から外す（カードで同じ行が二度出ないように）
      body: '本文テキスト',
      createdAt: '2026-04-11T10:00:00Z',
    });
  });

  it('見出しに使った行を本文から外す（カードで同じ行が二度出ない）', async () => {
    const entry = Entry.fromProps({
      id: 'entry-1',
      userId: 'user-1',
      content: '  \n見出しの行\n\n本文の1行目\n本文の2行目',
      mediaUrls: [],
      fermentationEnabled: false,
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    });
    const card = BoardCard.fromProps({
      id: 'card-1',
      userId: 'user-1',
      cardType: 'entry',
      refId: 'entry-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 0,
      y: 0,
      rotation: 0,
      width: 340,
      height: 280,
      zIndex: 0,
      userPositioned: false,
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    });
    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([card]);
    vi.mocked(entryRepo.findByIds).mockResolvedValue([entry]);

    const result = await usecase.execute('user-1', '2026-04-11');

    expect(result.cards[0].content).toMatchObject({
      // 先頭の空行は見出しにしない
      title: '見出しの行',
      body: '本文の1行目\n本文の2行目',
    });
  });

  it('本文が1行だけなら body は空になる（見出しがすべて）', async () => {
    const entry = Entry.fromProps({
      id: 'entry-1',
      userId: 'user-1',
      content: '一行だけの日記',
      mediaUrls: [],
      fermentationEnabled: false,
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    });
    const card = BoardCard.fromProps({
      id: 'card-1',
      userId: 'user-1',
      cardType: 'entry',
      refId: 'entry-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 0,
      y: 0,
      rotation: 0,
      width: 340,
      height: 280,
      zIndex: 0,
      userPositioned: false,
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    });
    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([card]);
    vi.mocked(entryRepo.findByIds).mockResolvedValue([entry]);

    const result = await usecase.execute('user-1', '2026-04-11');

    expect(result.cards[0].content).toMatchObject({ title: '一行だけの日記', body: '' });
  });

  it('その日のエントリがあってもカードを勝手に作らない', async () => {
    // 以前は期間内の日記を自動でカード化していた。置いた覚えのないカードが現れる
    // 一方で外し方が見えず、盤面が「自分で組み立てる場所」になっていなかった。
    // 置くのは PlaceEntryCardUsecase の仕事になった。
    const entry = Entry.fromProps({
      id: 'entry-new',
      userId: 'user-1',
      content: '新しいエントリ',
      mediaUrls: [],
      fermentationEnabled: false,
      createdAt: '2026-04-11T10:00:00Z',
      updatedAt: '2026-04-11T10:00:00Z',
    });
    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([]);
    vi.mocked(entryRepo.listByUserIdAndDate).mockResolvedValue([entry]);

    const result = await usecase.execute('user-1', '2026-04-11');

    expect(boardCardRepo.saveMany).not.toHaveBeenCalled();
    expect(result.cards).toHaveLength(0);
    // 日付でエントリを引くこと自体をやめている
    expect(entryRepo.listByUserIdAndDate).not.toHaveBeenCalled();
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

  it('weekly モードで daily のスニペット・写真カードも含める（weekly コピーを作成）', async () => {
    const dailySnippetCard = BoardCard.fromProps({
      id: 'card-ds1',
      userId: 'user-1',
      cardType: 'snippet',
      refId: 'snippet-d1',
      dateKey: '2026-04-09',
      viewType: 'daily',
      x: 100,
      y: 200,
      rotation: 0,
      width: 262,
      height: 120,
      zIndex: 0,
      createdAt: '2026-04-09T00:00:00Z',
      updatedAt: '2026-04-09T00:00:00Z',
    });
    const snippet = BoardSnippet.fromProps({
      id: 'snippet-d1',
      userId: 'user-1',
      text: 'dailyで作ったスニペット',
      createdAt: '2026-04-09T00:00:00Z',
      updatedAt: '2026-04-09T00:00:00Z',
    });

    vi.mocked(boardCardRepo.findDailyCardsByDateRange).mockResolvedValue([dailySnippetCard]);
    vi.mocked(boardSnippetRepo.findByIds).mockResolvedValue([snippet]);

    const result = await usecase.execute('user-1', '2026-04-11', 'weekly');

    expect(boardCardRepo.findDailyCardsByDateRange).toHaveBeenCalled();
    // Weekly copies are persisted so positions are independent per view
    expect(boardCardRepo.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          refId: 'snippet-d1',
          viewType: 'weekly',
          dateKey: '2026-04-11',
        }),
      ]),
    );
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].id).toBe('generated-id');
    expect(result.cards[0].cardType).toBe('snippet');
    expect(result.cards[0].content).toEqual({ text: 'dailyで作ったスニペット' });
  });

  it('weekly コピーは daily の位置を初期値として持つが独立したカードになる', async () => {
    const dailyEntryCard = BoardCard.fromProps({
      id: 'card-daily-1',
      userId: 'user-1',
      cardType: 'entry',
      refId: 'entry-1',
      dateKey: '2026-04-09',
      viewType: 'daily',
      x: 300,
      y: 400,
      rotation: 5,
      width: 340,
      height: 280,
      zIndex: 0,
      createdAt: '2026-04-09T00:00:00Z',
      updatedAt: '2026-04-09T00:00:00Z',
    });
    const entry = Entry.fromProps({
      id: 'entry-1',
      userId: 'user-1',
      content: 'テスト',
      mediaUrls: [],
      fermentationEnabled: false,
      createdAt: '2026-04-09T10:00:00Z',
      updatedAt: '2026-04-09T10:00:00Z',
    });

    vi.mocked(boardCardRepo.findDailyCardsByDateRange).mockResolvedValue([dailyEntryCard]);
    vi.mocked(boardCardRepo.findRefIdsByDateRange).mockResolvedValue(['entry-1']);
    vi.mocked(entryRepo.listByUserIdAndWeek).mockResolvedValue([entry]);
    vi.mocked(entryRepo.findByIds).mockResolvedValue([entry]);

    const result = await usecase.execute('user-1', '2026-04-11', 'weekly');

    // The weekly copy should have the daily card's position as initial values
    const savedCards = vi.mocked(boardCardRepo.saveMany).mock.calls[0]?.[0] ?? [];
    const weeklyCopy = savedCards.find(
      (c: BoardCard) => c.refId === 'entry-1' && c.viewType === 'weekly',
    );
    expect(weeklyCopy).toBeDefined();
    expect(weeklyCopy?.x).toBe(300);
    expect(weeklyCopy?.y).toBe(400);
    expect(weeklyCopy?.rotation).toBe(5);
    // The weekly copy has a different ID than the daily card
    expect(weeklyCopy?.id).not.toBe('card-daily-1');
    expect(result.cards).toHaveLength(1);
  });

  it('weekly で削除済みカードの daily 版がマージされない', async () => {
    const dailyEntryCard = BoardCard.fromProps({
      id: 'card-daily-e1',
      userId: 'user-1',
      cardType: 'entry',
      refId: 'entry-deleted',
      dateKey: '2026-04-09',
      viewType: 'daily',
      x: 100,
      y: 200,
      rotation: 0,
      width: 340,
      height: 280,
      zIndex: 0,
      createdAt: '2026-04-09T00:00:00Z',
      updatedAt: '2026-04-09T00:00:00Z',
    });
    const entry = Entry.fromProps({
      id: 'entry-deleted',
      userId: 'user-1',
      content: '削除したエントリ',
      mediaUrls: [],
      fermentationEnabled: false,
      createdAt: '2026-04-09T10:00:00Z',
      updatedAt: '2026-04-09T10:00:00Z',
    });

    vi.mocked(boardCardRepo.findDailyCardsByDateRange).mockResolvedValue([dailyEntryCard]);
    vi.mocked(boardCardRepo.findSoftDeletedRefIdsByDateAndView).mockResolvedValue([
      'entry-deleted',
    ]);
    vi.mocked(boardCardRepo.findRefIdsByDateAndView).mockResolvedValue(['entry-deleted']);
    vi.mocked(boardCardRepo.findRefIdsByDateRange).mockResolvedValue(['entry-deleted']);
    vi.mocked(entryRepo.listByUserIdAndWeek).mockResolvedValue([entry]);
    vi.mocked(entryRepo.findByIds).mockResolvedValue([]);

    const result = await usecase.execute('user-1', '2026-04-11', 'weekly');

    expect(result.cards).toHaveLength(0);
    expect(boardCardRepo.saveMany).not.toHaveBeenCalled();
  });
  it('photo カードは署名付き URL を imageUrl として返す（#504: 公開 URL を使わない）', async () => {
    const card = BoardCard.fromProps({
      id: 'card-p1',
      userId: 'user-1',
      cardType: 'photo',
      refId: 'photo-1',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 10,
      y: 20,
      rotation: 0,
      width: 260,
      height: 200,
      zIndex: 0,
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });
    const photo = BoardPhoto.fromProps({
      id: 'photo-1',
      userId: 'user-1',
      storagePath: 'user-1/1700000000-a.jpg',
      caption: '朝の風景',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });

    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([card]);
    vi.mocked(boardPhotoRepo.findByIds).mockResolvedValue([photo]);

    const result = await usecase.execute('user-1', '2026-04-11');

    expect(boardStorage.getSignedUrls).toHaveBeenCalledWith(['user-1/1700000000-a.jpg']);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].content).toEqual({
      imageUrl: 'https://example.com/signed/user-1/1700000000-a.jpg',
      caption: '朝の風景',
    });
  });

  it('署名に失敗した photo カードは結果から除外する', async () => {
    const card = BoardCard.fromProps({
      id: 'card-p2',
      userId: 'user-1',
      cardType: 'photo',
      refId: 'photo-2',
      dateKey: '2026-04-11',
      viewType: 'daily',
      x: 10,
      y: 20,
      rotation: 0,
      width: 260,
      height: 200,
      zIndex: 0,
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });
    const photo = BoardPhoto.fromProps({
      id: 'photo-2',
      userId: 'user-1',
      storagePath: 'user-1/missing.jpg',
      caption: '',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });

    vi.mocked(boardCardRepo.findByDateAndView).mockResolvedValue([card]);
    vi.mocked(boardPhotoRepo.findByIds).mockResolvedValue([photo]);
    vi.mocked(boardStorage.getSignedUrls).mockResolvedValue(new Map());

    const result = await usecase.execute('user-1', '2026-04-11');

    expect(result.cards).toHaveLength(0);
  });
});
