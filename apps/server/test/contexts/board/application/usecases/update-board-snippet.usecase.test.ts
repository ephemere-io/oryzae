import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BoardSnippetNotFoundError,
  BoardSnippetValidationError,
} from '@/contexts/board/application/errors/board.errors';
import { UpdateBoardSnippetUsecase } from '@/contexts/board/application/usecases/update-board-snippet.usecase';
import type { BoardSnippetRepositoryGateway } from '@/contexts/board/domain/gateways/board-snippet-repository.gateway';
import { BoardSnippet } from '@/contexts/board/domain/models/board-snippet';

let boardSnippetRepo: BoardSnippetRepositoryGateway;
let usecase: UpdateBoardSnippetUsecase;

beforeEach(() => {
  boardSnippetRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new UpdateBoardSnippetUsecase(boardSnippetRepo);
});

describe('UpdateBoardSnippetUsecase', () => {
  it('snippet のテキストを更新できる', async () => {
    const existing = BoardSnippet.fromProps({
      id: 's-1',
      userId: 'user-1',
      text: 'オリジナル',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });
    vi.mocked(boardSnippetRepo.findById).mockResolvedValue(existing);

    await usecase.execute('s-1', '更新後');

    expect(boardSnippetRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ text: '更新後' }),
    );
  });

  it('存在しない snippet で BoardSnippetNotFoundError を投げる', async () => {
    await expect(usecase.execute('no-exist', 'text')).rejects.toThrow(BoardSnippetNotFoundError);
  });

  it('空テキストで BoardSnippetValidationError を投げる', async () => {
    const existing = BoardSnippet.fromProps({
      id: 's-1',
      userId: 'user-1',
      text: 'オリジナル',
      createdAt: '2026-04-11T00:00:00Z',
      updatedAt: '2026-04-11T00:00:00Z',
    });
    vi.mocked(boardSnippetRepo.findById).mockResolvedValue(existing);

    await expect(usecase.execute('s-1', '')).rejects.toThrow(BoardSnippetValidationError);
  });
});
