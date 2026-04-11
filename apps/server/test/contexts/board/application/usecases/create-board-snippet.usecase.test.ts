import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardSnippetValidationError } from '@/contexts/board/application/errors/board.errors';
import { CreateBoardSnippetUsecase } from '@/contexts/board/application/usecases/create-board-snippet.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardSnippetRepositoryGateway } from '@/contexts/board/domain/gateways/board-snippet-repository.gateway';

const generateId = () => 'generated-id';

let boardSnippetRepo: BoardSnippetRepositoryGateway;
let boardCardRepo: BoardCardRepositoryGateway;
let usecase: CreateBoardSnippetUsecase;

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
    saveMany: vi.fn().mockResolvedValue(undefined),
    updatePositions: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new CreateBoardSnippetUsecase(boardSnippetRepo, boardCardRepo, generateId);
});

describe('CreateBoardSnippetUsecase', () => {
  it('snippet と card を同時作成できる', async () => {
    const result = await usecase.execute('user-1', {
      text: '重要な気づき',
      dateKey: '2026-04-11',
    });

    expect(boardSnippetRepo.save).toHaveBeenCalled();
    expect(boardCardRepo.saveMany).toHaveBeenCalled();
    expect(result.text).toBe('重要な気づき');
    expect(result.snippetId).toBe('generated-id');
    expect(result.cardId).toBe('generated-id');
  });

  it('空テキストで BoardSnippetValidationError を投げる', async () => {
    await expect(usecase.execute('user-1', { text: '', dateKey: '2026-04-11' })).rejects.toThrow(
      BoardSnippetValidationError,
    );
  });

  it('51文字超で BoardSnippetValidationError を投げる', async () => {
    await expect(
      usecase.execute('user-1', { text: 'a'.repeat(51), dateKey: '2026-04-11' }),
    ).rejects.toThrow(BoardSnippetValidationError);
  });
});
