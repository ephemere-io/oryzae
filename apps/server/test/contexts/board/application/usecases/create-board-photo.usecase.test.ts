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

  it('21文字超の caption で BoardPhotoValidationError を投げる', async () => {
    await expect(
      usecase.execute('user-1', { ...validInput, caption: 'a'.repeat(21) }),
    ).rejects.toThrow(BoardPhotoValidationError);
  });
});
