import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteBoardSnippetUsecase } from '@/contexts/board/application/usecases/delete-board-snippet.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardSnippetRepositoryGateway } from '@/contexts/board/domain/gateways/board-snippet-repository.gateway';

let boardSnippetRepo: BoardSnippetRepositoryGateway;
let boardCardRepo: BoardCardRepositoryGateway;
let usecase: DeleteBoardSnippetUsecase;

beforeEach(() => {
  boardSnippetRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  boardCardRepo = {
    findByDateAndView: vi.fn().mockResolvedValue([]),
    findRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findDailyCardsByDateRange: vi.fn().mockResolvedValue([]),
    findRefIdsByDateRange: vi.fn().mockResolvedValue([]),
    findSoftDeletedRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findMaxZIndex: vi.fn().mockResolvedValue(-1),
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new DeleteBoardSnippetUsecase(boardSnippetRepo, boardCardRepo);
});

describe('DeleteBoardSnippetUsecase', () => {
  it('snippet と関連カードを同時削除する', async () => {
    await usecase.execute('snippet-1', 'user-1');

    expect(boardCardRepo.deleteByRefId).toHaveBeenCalledWith('snippet-1', 'user-1');
    expect(boardSnippetRepo.delete).toHaveBeenCalledWith('snippet-1');
  });
});
