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
    findDailyCardsByDateRange: vi.fn().mockResolvedValue([]),
    findRefIdsByDateRange: vi.fn().mockResolvedValue([]),
    findSoftDeletedRefIdsByDateAndView: vi.fn().mockResolvedValue([]),
    findMaxZIndex: vi.fn().mockResolvedValue(-1),
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

  // ボードがパン・ズームできるようになったので、配置はクライアントが決められる。
  // サーバー既定（固定範囲のランダム）のままだと、遠くを見ている状態で作ったカードが
  // 画面外に生まれて「押したのに何も起きない」ように見える。
  it('x/y を渡すとその座標にカードを置く', async () => {
    const result = await usecase.execute('user-1', {
      text: '見えている場所に置く',
      dateKey: '2026-04-11',
      x: -1234.5,
      y: 987.25,
    });

    expect(result.x).toBe(-1234.5);
    expect(result.y).toBe(987.25);
  });

  it('x/y を渡さなければ従来どおりランダムに散らす（エディタからの作成）', async () => {
    const result = await usecase.execute('user-1', {
      text: 'ランダム配置',
      dateKey: '2026-04-11',
    });

    expect(result.x).toBeGreaterThanOrEqual(60);
    expect(result.x).toBeLessThanOrEqual(800);
    expect(result.y).toBeGreaterThanOrEqual(60);
    expect(result.y).toBeLessThanOrEqual(600);
  });

  it('負の座標も受け付ける（無限キャンバスでは原点より左上も正しい位置）', async () => {
    const result = await usecase.execute('user-1', {
      text: '原点の外',
      dateKey: '2026-04-11',
      x: -5000,
      y: -3000,
    });

    expect(result.x).toBe(-5000);
    expect(result.y).toBe(-3000);
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
