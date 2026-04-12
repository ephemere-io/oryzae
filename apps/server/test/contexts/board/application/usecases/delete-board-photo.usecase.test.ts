import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardPhotoNotFoundError } from '@/contexts/board/application/errors/board.errors';
import { DeleteBoardPhotoUsecase } from '@/contexts/board/application/usecases/delete-board-photo.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardPhotoRepositoryGateway } from '@/contexts/board/domain/gateways/board-photo-repository.gateway';
import type { BoardStorageGateway } from '@/contexts/board/domain/gateways/board-storage.gateway';
import { BoardPhoto } from '@/contexts/board/domain/models/board-photo';

let boardPhotoRepo: BoardPhotoRepositoryGateway;
let boardCardRepo: BoardCardRepositoryGateway;
let boardStorage: BoardStorageGateway;
let usecase: DeleteBoardPhotoUsecase;

beforeEach(() => {
  boardPhotoRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  boardStorage = {
    upload: vi.fn().mockResolvedValue('path'),
    getPublicUrl: vi.fn().mockReturnValue('url'),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new DeleteBoardPhotoUsecase(boardPhotoRepo, boardCardRepo, boardStorage);
});

describe('DeleteBoardPhotoUsecase', () => {
  it('photo, card, storage ファイルを同時削除する', async () => {
    const photo = BoardPhoto.fromProps({
      id: 'p-1',
      userId: 'user-1',
      storagePath: 'user-1/photo.jpg',
      caption: '',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });
    vi.mocked(boardPhotoRepo.findById).mockResolvedValue(photo);

    await usecase.execute('p-1', 'user-1');

    expect(boardCardRepo.deleteByRefId).toHaveBeenCalledWith('p-1', 'user-1');
    expect(boardPhotoRepo.delete).toHaveBeenCalledWith('p-1');
    expect(boardStorage.delete).toHaveBeenCalledWith('user-1/photo.jpg');
  });

  it('存在しない photo で BoardPhotoNotFoundError を投げる', async () => {
    await expect(usecase.execute('no-exist', 'user-1')).rejects.toThrow(BoardPhotoNotFoundError);
  });
});
