import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardSnippetValidationError } from '@/contexts/board/application/errors/board.errors';
import { CreateBoardSnippetUsecase } from '@/contexts/board/application/usecases/create-board-snippet.usecase';
import type { BoardCardRepositoryGateway } from '@/contexts/board/domain/gateways/board-card-repository.gateway';
import type { BoardSnippetRepositoryGateway } from '@/contexts/board/domain/gateways/board-snippet-repository.gateway';

const generateId = () => 'generated-id';

let boardSnippetRepo: BoardSnippetRepositoryGateway;
let boardCardRepo: BoardCardRepositoryGateway;
let usecase: CreateBoardSnippetUsecase;

/** 保存されたカード（n 回目の save）の高さ。 */
function savedHeight(call: number): number | undefined {
  return vi.mocked(boardCardRepo.save).mock.calls[call]?.[0].height;
}

beforeEach(() => {
  boardSnippetRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
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
  usecase = new CreateBoardSnippetUsecase(boardSnippetRepo, boardCardRepo, generateId);
});

describe('CreateBoardSnippetUsecase', () => {
  it('snippet と card を同時作成できる', async () => {
    const result = await usecase.execute('user-1', { text: '重要な気づき' });

    expect(boardSnippetRepo.save).toHaveBeenCalled();
    expect(boardCardRepo.save).toHaveBeenCalled();
    expect(result.text).toBe('重要な気づき');
    expect(result.snippetId).toBe('generated-id');
    expect(result.cardId).toBe('generated-id');
  });

  it('新しいカードはボード全体でいちばん上に置く', async () => {
    // ボードは 1 人に 1 枚。日付ごとの盤面で最大値を見ていたころは、別の日のカードより
    // 下に潜ることがあった。
    vi.mocked(boardCardRepo.findMaxZIndex).mockResolvedValue(7);

    const result = await usecase.execute('user-1', { text: '上に置く' });

    expect(boardCardRepo.findMaxZIndex).toHaveBeenCalledWith('user-1');
    expect(result.zIndex).toBe(8);
  });

  // ボードがパン・ズームできるようになったので、配置はクライアントが決められる。
  // サーバー既定（固定範囲のランダム）のままだと、遠くを見ている状態で作ったカードが
  // 画面外に生まれて「押したのに何も起きない」ように見える。
  it('x/y を渡すとその座標にカードを置く', async () => {
    const result = await usecase.execute('user-1', {
      text: '見えている場所に置く',
      x: -1234.5,
      y: 987.25,
    });

    expect(result.x).toBe(-1234.5);
    expect(result.y).toBe(987.25);
  });

  it('x/y を渡さなければ従来どおりランダムに散らす（エディタからの作成）', async () => {
    const result = await usecase.execute('user-1', { text: 'ランダム配置' });

    expect(result.x).toBeGreaterThanOrEqual(60);
    expect(result.x).toBeLessThanOrEqual(800);
    expect(result.y).toBeGreaterThanOrEqual(60);
    expect(result.y).toBeLessThanOrEqual(600);
  });

  it('負の座標も受け付ける（無限キャンバスでは原点より左上も正しい位置）', async () => {
    const result = await usecase.execute('user-1', { text: '原点の外', x: -5000, y: -3000 });

    expect(result.x).toBe(-5000);
    expect(result.y).toBe(-3000);
  });

  it('空テキストで BoardSnippetValidationError を投げる', async () => {
    await expect(usecase.execute('user-1', { text: '' })).rejects.toThrow(
      BoardSnippetValidationError,
    );
  });

  it('上限超えで BoardSnippetValidationError を投げる', async () => {
    await expect(usecase.execute('user-1', { text: 'a'.repeat(2001) })).rejects.toThrow(
      BoardSnippetValidationError,
    );
  });

  it('本文が長いほどカードを高くする（切れて読めなくならないように）', async () => {
    await usecase.execute('user-1', { text: '短い' });
    const short = savedHeight(0);

    await usecase.execute('user-1', { text: 'あ'.repeat(400) });
    const long = savedHeight(1);

    expect(short).toBe(120);
    expect(long).toBeGreaterThan(short ?? 0);
  });

  it('数行ぶんの本文は、その行数に見合う高さになる', async () => {
    // 上限(480)に当たらない範囲を測る。ここが合っていないと、上限だけ見るテストは
    // 「常に 480 を返す」実装でも通ってしまう。
    // 1行 ≒ 15文字・25.2px、上下の余白とバッジで 72px。
    await usecase.execute('user-1', { text: 'あ'.repeat(150) });
    const height = savedHeight(0);

    // 150文字 ≒ 10行 → 72 + 252 ≒ 324px
    expect(height).toBeGreaterThan(280);
    expect(height).toBeLessThan(380);
  });

  it('どれだけ長くてもカードは盤面を覆うほどには伸びない', async () => {
    // 上限まで書くと見積もりは 3000px を超えるが、1枚で盤面が埋まるほうが困る。
    // 480 で頭打ちにして、入りきらない分はカードの中で送る（SnippetCardContent の
    // overflow-auto）。**上限いっぱいの本文は一度に全部は見えない**のは承知のうえ。
    await usecase.execute('user-1', { text: 'あ'.repeat(2000) });

    expect(savedHeight(0)).toBe(480);
  });
});
