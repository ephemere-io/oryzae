import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteCardUsecase } from '@/contexts/board/application/usecases/delete-card.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';

let boardCardRepo: BoardCardRepositoryGateway;
let usecase: DeleteCardUsecase;

beforeEach(() => {
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateRange: vi.fn().mockResolvedValue([]),
    findSoftDeletedRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new DeleteCardUsecase(boardCardRepo);
});

describe('DeleteCardUsecase', () => {
  it('カードを削除できる', async () => {
    await usecase.execute('card-1', 'user-1');

    expect(boardCardRepo.delete).toHaveBeenCalledWith('card-1', 'user-1');
  });
});
