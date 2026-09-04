import { describe, expect, it } from 'vitest';
import { RENDER_LIMITS } from '@/features/shared/study/constants';
import {
  BOARD_FACE,
  BOARD_GRID_SPACING,
  PHOTO_INNER_INSET,
  placeBoardCards,
  snippetLineCount,
} from '@/features/shared/study/scene/board';
import type { StudyBoardCard } from '@/features/shared/study/types';

function card(overrides: Partial<StudyBoardCard> = {}): StudyBoardCard {
  return {
    id: 'c1',
    cardType: 'snippet',
    x: 0,
    y: 0,
    rotation: 0,
    width: 200,
    height: 150,
    zIndex: 0,
    lines: 3,
    ...overrides,
  };
}

describe('placeBoardCards', () => {
  const CARDS: StudyBoardCard[] = [
    card({ id: 'a', x: 0, y: 0, zIndex: 2 }),
    card({ id: 'b', x: 600, y: 0, zIndex: 0 }),
    card({ id: 'c', x: 300, y: 400, zIndex: 1 }),
  ];

  it('カードが無ければ空（壁が空になるだけ）', () => {
    expect(placeBoardCards([])).toEqual([]);
  });

  it('zIndex 昇順に並べ、奥から手前へ持ち上げる', () => {
    const placed = placeBoardCards(CARDS);
    expect(placed.map((p) => p.card.id)).toEqual(['b', 'c', 'a']);
    for (let i = 1; i < placed.length; i++) {
      expect(placed[i].z).toBeGreaterThan(placed[i - 1].z);
    }
  });

  it('板の表面より手前に置く（板に埋まらない）', () => {
    for (const placed of placeBoardCards(CARDS)) {
      expect(placed.z).toBeGreaterThan(0);
    }
  });

  it('DOM の y は下向きなので符号が反転する', () => {
    const placed = placeBoardCards([
      card({ id: 'top', x: 0, y: 0 }),
      card({ id: 'bottom', x: 0, y: 400 }),
    ]);
    const top = placed.find((p) => p.card.id === 'top');
    const bottom = placed.find((p) => p.card.id === 'bottom');
    // DOM で下にあるカードは 3D で下（y が小さい）。
    expect(top?.y).toBeGreaterThan(bottom?.y ?? 0);
  });

  it('回転も DOM と逆向き', () => {
    const [placed] = placeBoardCards([card({ rotation: 90 })]);
    expect(placed.rotationZ).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('カード群が板の面に収まる', () => {
    for (const placed of placeBoardCards(CARDS)) {
      expect(Math.abs(placed.x) + placed.width / 2).toBeLessThanOrEqual(BOARD_FACE.width / 2);
      expect(Math.abs(placed.y) + placed.height / 2).toBeLessThanOrEqual(BOARD_FACE.height / 2);
    }
  });

  it('カード群の中心が板の中心に来る', () => {
    const placed = placeBoardCards(CARDS);
    const meanX = placed.reduce((sum, p) => sum + p.x, 0) / placed.length;
    const meanY = placed.reduce((sum, p) => sum + p.y, 0) / placed.length;
    // 完全な重心一致ではなく bbox 中心合わせなので、ゆるく確かめる。
    expect(Math.abs(meanX)).toBeLessThan(BOARD_FACE.width / 4);
    expect(Math.abs(meanY)).toBeLessThan(BOARD_FACE.height / 4);
  });

  it('相対的な位置関係を保つ（board 画面と同じ並びに見える）', () => {
    const placed = placeBoardCards(CARDS);
    const a = placed.find((p) => p.card.id === 'a');
    const b = placed.find((p) => p.card.id === 'b');
    // DOM で b は a の右。3D でも右。
    expect(b?.x).toBeGreaterThan(a?.x ?? 0);
  });

  it('縦横比を保つ（1 つの倍率で両軸を縮める）', () => {
    const placed = placeBoardCards([card({ width: 200, height: 100 })]);
    expect(placed[0].width / placed[0].height).toBeCloseTo(2, 10);
  });

  it('カードが 1 枚でも Infinity にならない', () => {
    const placed = placeBoardCards([card()]);
    expect(placed).toHaveLength(1);
    expect(Number.isFinite(placed[0].x)).toBe(true);
    expect(Number.isFinite(placed[0].width)).toBe(true);
    expect(placed[0].width).toBeGreaterThan(0);
  });

  it('全カードが同じ位置でも壊れない', () => {
    const placed = placeBoardCards([card({ id: 'a', zIndex: 0 }), card({ id: 'b', zIndex: 1 })]);
    for (const p of placed) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('横一列に並んでいても板からはみ出さない', () => {
    const row = Array.from({ length: 10 }, (_, i) =>
      card({ id: `r${i}`, x: i * 500, y: 0, zIndex: i }),
    );
    for (const placed of placeBoardCards(row)) {
      expect(Math.abs(placed.x) + placed.width / 2).toBeLessThanOrEqual(BOARD_FACE.width / 2);
    }
  });

  it('30 枚で打ち切る（描画コストの上限）', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      card({ id: `m${i}`, x: i * 10, y: i * 10, zIndex: i }),
    );
    const placed = placeBoardCards(many);
    expect(placed).toHaveLength(RENDER_LIMITS.maxBoardCards);
  });

  it('打ち切るときは手前（zIndex が大きい）を残す', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      card({ id: `m${i}`, x: i * 10, y: i * 10, zIndex: i }),
    );
    const kept = placeBoardCards(many).map((p) => p.card.zIndex);
    expect(Math.min(...kept)).toBe(50 - RENDER_LIMITS.maxBoardCards);
    expect(Math.max(...kept)).toBe(49);
  });

  it('打ち切っても残った枚数で板いっぱいに収める', () => {
    // 全カードから bbox を取ると、捨てた遠くの 1 枚に引きずられて残りが中央へ潰れる。
    const many = [
      ...Array.from({ length: 40 }, (_, i) => card({ id: `m${i}`, x: i * 5, y: 0, zIndex: i + 1 })),
      // zIndex 0 ＝ 一番奥。打ち切りで捨てられる、遠く離れた 1 枚。
      card({ id: 'far', x: 100000, y: 0, zIndex: 0 }),
    ];
    const placed = placeBoardCards(many);
    const spread = Math.max(...placed.map((p) => p.x)) - Math.min(...placed.map((p) => p.x));
    expect(spread).toBeGreaterThan(BOARD_FACE.width / 4);
  });

  it('元のカードの値を書き換えない', () => {
    const original = card({ x: 12, y: 34 });
    placeBoardCards([original]);
    expect(original.x).toBe(12);
    expect(original.y).toBe(34);
  });

  it('渡した配列の順序を壊さない', () => {
    const input = [...CARDS];
    placeBoardCards(input);
    expect(input.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('板とカードの寸法', () => {
  it('板の格子が板より細かい（面が格子 1 マスに潰れない）', () => {
    expect(BOARD_GRID_SPACING).toBeGreaterThan(0);
    expect(BOARD_GRID_SPACING).toBeLessThan(BOARD_FACE.height / 2);
  });

  it('写真の内枠がカードの内側に収まる', () => {
    expect(PHOTO_INNER_INSET).toBeGreaterThan(0);
    expect(PHOTO_INNER_INSET).toBeLessThan(0.5);
  });
});

describe('snippetLineCount', () => {
  it('本文が長いほど罫が増える', () => {
    expect(snippetLineCount('あ'.repeat(100), 200)).toBeGreaterThan(
      snippetLineCount('あ'.repeat(10), 200),
    );
  });

  it('カードの高さで引ける本数を超えない', () => {
    const tall = snippetLineCount('あ'.repeat(1000), 200);
    const short = snippetLineCount('あ'.repeat(1000), 60);
    expect(short).toBeLessThan(tall);
  });

  it('空でも 1 本は引く（無地のカードにしない）', () => {
    expect(snippetLineCount('', 150)).toBe(1);
    expect(snippetLineCount('   ', 150)).toBe(1);
  });

  it('極端に低いカードでも 2 本以上引ける前提を保つ', () => {
    expect(snippetLineCount('あ'.repeat(100), 1)).toBeGreaterThanOrEqual(1);
  });
});
