import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadBoardUsecase } from '@/contexts/board/application/usecases/load-board.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardPhotoRepositoryGateway } from '@/contexts/board/domain/gateways/board-photo-repository.gateway';
import type { BoardSnippetRepositoryGateway } from '@/contexts/board/domain/gateways/board-snippet-repository.gateway';
import type { BoardStorageGateway } from '@/contexts/board/domain/gateways/board-storage.gateway';
import { BoardCard } from '@/contexts/board/domain/models/board-card';
import { BoardPhoto } from '@/contexts/board/domain/models/board-photo';
import { BoardSnippet } from '@/contexts/board/domain/models/board-snippet';

let boardCardRepo: BoardCardRepositoryGateway;
let boardSnippetRepo: BoardSnippetRepositoryGateway;
let boardPhotoRepo: BoardPhotoRepositoryGateway;
let boardStorage: BoardStorageGateway;
let usecase: LoadBoardUsecase;

function card(
  id: string,
  cardType: 'entry' | 'snippet' | 'photo',
  refId: string,
  createdAt = '2026-04-11T00:00:00Z',
): BoardCard {
  return BoardCard.fromProps({
    id,
    userId: 'user-1',
    cardType,
    refId,
    x: 100,
    y: 200,
    rotation: 0,
    width: 262,
    height: 120,
    zIndex: 0,
    userPositioned: false,
    createdAt,
    updatedAt: createdAt,
  });
}

function snippet(id: string, text: string): BoardSnippet {
  return BoardSnippet.fromProps({
    id,
    userId: 'user-1',
    text,
    createdAt: '2026-04-11T00:00:00Z',
    updatedAt: '2026-04-11T00:00:00Z',
  });
}

beforeEach(() => {
  boardCardRepo = {
    findByUserId: vi.fn().mockResolvedValue([]),
    findMaxZIndex: vi.fn().mockResolvedValue(-1),
    countPinnedByType: vi.fn().mockResolvedValue({ snippet: 0, photo: 0 }),
    findRecentByUserId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
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
    getSignedUrls: vi
      .fn()
      .mockImplementation(
        async (paths: string[]) =>
          new Map(paths.map((path) => [path, `https://example.com/signed/${path}`])),
      ),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new LoadBoardUsecase(boardCardRepo, boardSnippetRepo, boardPhotoRepo, boardStorage);
});

describe('LoadBoardUsecase', () => {
  it('いつ貼ったカードも 1 枚のボードにまとめて返す（日付・表示単位で絞らない）', async () => {
    vi.mocked(boardCardRepo.findByUserId).mockResolvedValue([
      card('card-old', 'snippet', 'snippet-old', '2026-04-01T00:00:00Z'),
      card('card-new', 'snippet', 'snippet-new', '2026-09-10T00:00:00Z'),
    ]);
    vi.mocked(boardSnippetRepo.findByIds).mockResolvedValue([
      snippet('snippet-old', '春に貼ったもの'),
      snippet('snippet-new', '昨日貼ったもの'),
    ]);

    const result = await usecase.execute('user-1');

    expect(boardCardRepo.findByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ cards: expect.any(Array) });
    expect(result.cards.map((c) => c.content)).toEqual([
      { text: '春に貼ったもの' },
      { text: '昨日貼ったもの' },
    ]);
    // 開くだけで行を作らない（週次の盤面のためにコピーを作っていたころの名残が無いこと）
    expect(boardCardRepo.save).not.toHaveBeenCalled();
  });

  it('過去に置かれた日記のカードは盤面に出さない（行は消さずに読み飛ばす）', async () => {
    // ボードは付箋と写真を貼る場所で、日記は瓶に漬け込むもの、という切り分けにした。
    // 既に置かれている entry の行は DB に残してあるので、ここで落ちることを確かめる。
    vi.mocked(boardCardRepo.findByUserId).mockResolvedValue([
      card('card-entry-1', 'entry', 'entry-1'),
    ]);

    const result = await usecase.execute('user-1');

    expect(result.cards).toHaveLength(0);
    expect(boardCardRepo.delete).not.toHaveBeenCalled();
    expect(boardCardRepo.deleteByRefId).not.toHaveBeenCalled();
  });

  it('photo カードは署名付き URL を imageUrl として返す（#504: 公開 URL を使わない）', async () => {
    const photo = BoardPhoto.fromProps({
      id: 'photo-1',
      userId: 'user-1',
      storagePath: 'user-1/1700000000-a.jpg',
      caption: '朝の風景',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });

    vi.mocked(boardCardRepo.findByUserId).mockResolvedValue([card('card-p1', 'photo', 'photo-1')]);
    vi.mocked(boardPhotoRepo.findByIds).mockResolvedValue([photo]);

    const result = await usecase.execute('user-1');

    expect(boardStorage.getSignedUrls).toHaveBeenCalledWith(['user-1/1700000000-a.jpg']);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].content).toEqual({
      imageUrl: 'https://example.com/signed/user-1/1700000000-a.jpg',
      caption: '朝の風景',
    });
  });

  it('署名に失敗した photo カードは結果から除外する', async () => {
    const photo = BoardPhoto.fromProps({
      id: 'photo-2',
      userId: 'user-1',
      storagePath: 'user-1/missing.jpg',
      caption: '',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });

    vi.mocked(boardCardRepo.findByUserId).mockResolvedValue([card('card-p2', 'photo', 'photo-2')]);
    vi.mocked(boardPhotoRepo.findByIds).mockResolvedValue([photo]);
    vi.mocked(boardStorage.getSignedUrls).mockResolvedValue(new Map());

    const result = await usecase.execute('user-1');

    expect(result.cards).toHaveLength(0);
  });
});
