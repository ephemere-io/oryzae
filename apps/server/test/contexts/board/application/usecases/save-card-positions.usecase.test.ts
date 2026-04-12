import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardCardValidationError } from '@/contexts/board/application/errors/board.errors';
import { SaveCardPositionsUsecase } from '@/contexts/board/application/usecases/save-card-positions.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';

let boardCardRepo: BoardCardRepositoryGateway;
let usecase: SaveCardPositionsUsecase;

beforeEach(() => {
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findDailyCardsByDateRange: vi.fn().mockResolvedValue([]),
    findRefIdsByDateRange: vi.fn().mockResolvedValue([]),
    findSoftDeletedRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new SaveCardPositionsUsecase(boardCardRepo);
});

describe('SaveCardPositionsUsecase', () => {
  it('カード位置を一括更新できる', async () => {
    const cards = [
      { id: 'c-1', x: 100, y: 200, rotation: -3, width: 340, height: 280, zIndex: 1 },
      { id: 'c-2', x: 500, y: 300, rotation: 2, width: 260, height: 150, zIndex: 2 },
    ];

    await usecase.execute(cards);

    expect(boardCardRepo.updatePositions).toHaveBeenCalledWith(cards);
  });

  it('120px 未満のサイズで BoardCardValidationError を投げる', async () => {
    const cards = [{ id: 'c-1', x: 100, y: 200, rotation: 0, width: 119, height: 280, zIndex: 1 }];

    await expect(usecase.execute(cards)).rejects.toThrow(BoardCardValidationError);
  });
});
