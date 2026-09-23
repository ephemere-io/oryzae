import { describe, expect, it } from 'vitest';
import {
  type CardGeometry,
  groupScaleFactor,
  MIN_CARD_SIZE,
  scaleSelection,
  selectionBounds,
  toggleSelection,
} from '@/features/shared/board/selection';
import type { BoardCardData } from '@/features/shared/board/types';

/**
 * まとめて動かす・まとめて伸ばすの算数。
 *
 * 見た目の確認では「なんとなく変」までしか分からない（どのカードがどれだけずれたのかを
 * 目で追えない）ので、規則そのものをここで固定する。
 */
function card(id: string, x: number, y: number, width = 262, height = 120): BoardCardData {
  return {
    id,
    cardType: 'snippet',
    refId: `s-${id}`,
    x,
    y,
    rotation: 0,
    width,
    height,
    zIndex: 1,
    userPositioned: true,
    createdAt: '2026-09-01T00:00:00Z',
    content: { text: 'あ' },
  };
}

const geometry = (c: BoardCardData): CardGeometry => ({
  id: c.id,
  x: c.x,
  y: c.y,
  width: c.width,
  height: c.height,
});

describe('toggleSelection', () => {
  it('入っていなければ足す', () => {
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('既に入っていれば外す（選びすぎを戻せる）', () => {
    expect(toggleSelection(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('元の配列を書き換えない', () => {
    const ids = ['a'];
    toggleSelection(ids, 'b');
    expect(ids).toEqual(['a']);
  });
});

describe('selectionBounds', () => {
  const cards = [card('a', 0, 0), card('b', 300, 200)];

  it('選んだカードを全部囲む矩形を返す', () => {
    expect(selectionBounds(cards, ['a', 'b'])).toEqual({
      x: 0,
      y: 0,
      width: 562,
      height: 320,
    });
  });

  it('選んでいないカードは含めない', () => {
    expect(selectionBounds(cards, ['a'])).toEqual({ x: 0, y: 0, width: 262, height: 120 });
  });

  it('消えかけのカードは数えない（枠だけ残って見える）', () => {
    const removing = [card('a', 0, 0), { ...card('b', 900, 900), removing: true }];
    expect(selectionBounds(removing, ['a', 'b'])).toEqual({
      x: 0,
      y: 0,
      width: 262,
      height: 120,
    });
  });

  it('1 枚も無ければ null', () => {
    expect(selectionBounds(cards, [])).toBeNull();
    expect(selectionBounds(cards, ['missing'])).toBeNull();
  });
});

describe('scaleSelection', () => {
  const cards = [card('a', 0, 0, 200, 100), card('b', 300, 200, 200, 100)];
  const starts = cards.map(geometry);
  // 囲みは x:0..500, y:0..300
  const box = { x: 0, y: 0, width: 500, height: 300 };

  it('右下を外へ引くと、掴んだ角の反対側（左上）は動かない', () => {
    const next = scaleSelection(starts, box, 'se', 500, 300);
    const a = next.find((c) => c.id === 'a');
    expect(a?.x).toBe(0);
    expect(a?.y).toBe(0);
    // 縦横とも 2 倍を引いたので倍率は 2
    expect(a?.width).toBe(400);
    expect(a?.height).toBe(200);
  });

  it('カード同士の間隔も一緒に伸びる（重ならない・隙間だけ空かない）', () => {
    const next = scaleSelection(starts, box, 'se', 500, 300);
    const b = next.find((c) => c.id === 'b');
    expect(b?.x).toBe(600);
    expect(b?.y).toBe(400);
  });

  it('左上を掴んだときは右下が動かない', () => {
    const next = scaleSelection(starts, box, 'nw', -500, -300);
    const b = next.find((c) => c.id === 'b');
    // 右下端（500, 300）が固定点。b の右下は元どおり
    expect((b?.x ?? 0) + (b?.width ?? 0)).toBe(500);
    expect((b?.y ?? 0) + (b?.height ?? 0)).toBe(300);
  });

  it('縦横ばらばらには伸ばさない（傾いたカードが歪むため、平均して等方に）', () => {
    // 横だけ 2 倍に引く → 倍率は (2 + 1) / 2 = 1.5
    const next = scaleSelection(starts, box, 'se', 500, 0);
    const a = next.find((c) => c.id === 'a');
    expect(a?.width).toBe(300);
    expect(a?.height).toBe(150);
  });

  it('どのカードも最小の辺を割らないところで止まる', () => {
    const next = scaleSelection(starts, box, 'se', -490, -290);
    const smallest = Math.min(...next.map((c) => Math.min(c.width, c.height)));
    expect(smallest).toBeGreaterThanOrEqual(MIN_CARD_SIZE);
  });

  it('潰れた囲み（幅ゼロ）では何も起きない', () => {
    const flat = { x: 0, y: 0, width: 0, height: 0 };
    expect(groupScaleFactor(starts, flat, 'se', 100, 100)).toBe(1);
  });
});
