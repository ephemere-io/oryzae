import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardPhotoValidationError } from '@/contexts/board/application/errors/board.errors';
import { CreateBoardPhotoUsecase } from '@/contexts/board/application/usecases/create-board-photo.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardPhotoRepositoryGateway } from '@/contexts/board/domain/gateways/board-photo-repository.gateway';
import type { BoardStorageGateway } from '@/contexts/board/domain/gateways/board-storage.gateway';

const generateId = () => 'generated-id';

let boardPhotoRepo: BoardPhotoRepositoryGateway;
let boardCardRepo: BoardCardRepositoryGateway;
let boardStorage: BoardStorageGateway;
let usecase: CreateBoardPhotoUsecase;

beforeEach(() => {
  boardPhotoRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findDailyCardsByDateRange: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateRange: vi.fn().mockResolvedValue([]),
    findSoftDeletedRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findMaxZIndex: vi.fn().mockResolvedValue(-1),
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  boardStorage = {
    upload: vi.fn().mockResolvedValue('user-1/photo.jpg'),
    getPublicUrl: vi.fn().mockReturnValue('https://storage.example.com/user-1/photo.jpg'),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new CreateBoardPhotoUsecase(boardPhotoRepo, boardCardRepo, boardStorage, generateId);
});

describe('CreateBoardPhotoUsecase', () => {
  const validInput = {
    file: new ArrayBuffer(100),
    fileName: 'test.jpg',
    contentType: 'image/jpeg',
    caption: '朝の風景',
    dateKey: '2026-04-11',
  };

  it('photo と card を同時作成できる', async () => {
    const result = await usecase.execute('user-1', validInput);

    expect(boardStorage.upload).toHaveBeenCalled();
    expect(boardPhotoRepo.save).toHaveBeenCalled();
    expect(boardCardRepo.saveMany).toHaveBeenCalled();
    expect(result.imageUrl).toBe('https://storage.example.com/user-1/photo.jpg');
    expect(result.caption).toBe('朝の風景');
  });

  it('画像寸法未指定時はデフォルトの縦長カードを作成する', async () => {
    const result = await usecase.execute('user-1', validInput);

    expect(result.width).toBe(200);
    expect(result.height).toBe(250);
  });

  it('横長画像のアスペクト比を保持したカード寸法になる', async () => {
    const result = await usecase.execute('user-1', {
      ...validInput,
      imageWidth: 1600,
      imageHeight: 800,
    });

    // 176 / 2 + 68 = 156, min 120 を満たす
    expect(result.width).toBe(200);
    expect(result.height).toBe(156);
  });

  it('縦長画像のアスペクト比を保持し、高さ上限で幅を縮小する', async () => {
    const result = await usecase.execute('user-1', {
      ...validInput,
      imageWidth: 400,
      imageHeight: 1600,
    });

    // aspectRatio 0.25 → imgH = 176/0.25 = 704 → cap 360, imgH = 292, imgW = 73, cardW = 97
    // MIN 120 でクランプ
    expect(result.height).toBe(360);
    expect(result.width).toBe(120);
  });

  it('正方形画像では幅 200 を保ち高さがアスペクト比に合う', async () => {
    const result = await usecase.execute('user-1', {
      ...validInput,
      imageWidth: 1000,
      imageHeight: 1000,
    });

    // 176 + 68 = 244
    expect(result.width).toBe(200);
    expect(result.height).toBe(244);
  });

  it('21文字超の caption で BoardPhotoValidationError を投げる', async () => {
    await expect(
      usecase.execute('user-1', { ...validInput, caption: 'a'.repeat(21) }),
    ).rejects.toThrow(BoardPhotoValidationError);
  });
});
