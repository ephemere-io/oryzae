import { describe, expect, it } from 'vitest';
import type { BoardCardData } from '@/features/shared/board/types';
import { frontZIndex, raiseToFront } from '@/features/shared/board/z-order';

/**
 * 「前面へ出す」規則は PC と SP の両方がここを通る。
 *
 * フィクスチャは**実際にありそうな盤面**にする。z が 0,1,2 と並んだきれいな盤面でしか
 * 試していなかったせいで、「前のセッションで手前に置いたカード（z=500）より下に潜る」
 * という壊れ方を長いあいだ拾えなかった。
 */
function card(id: string, zIndex: number, userPositioned = false): BoardCardData {
  return {
    id,
    cardType: 'snippet',
    refId: `s-${id}`,
    x: 0,
    y: 0,
    rotation: 0,
    width: 262,
    height: 120,
    zIndex,
    userPositioned,
    createdAt: '2026-09-01T00:00:00Z',
    content: { text: 'あ' },
  };
}

/** 長く使った盤面。自動配置のカードに混じって、手で前面へ出したカードが残っている。 */
const LIVED_IN = [
  card('auto-1', 0),
  card('auto-2', 1),
  card('auto-3', 2),
  card('pinned-old', 500, true),
];

describe('frontZIndex', () => {
  it('前のセッションで手前に置いたカード（z が大きい）より上を返す', () => {
    expect(frontZIndex(LIVED_IN, 'auto-1')).toBe(501);
  });

  it('既に最前面なら null（盤面に変化が無いので保存要求も出さない）', () => {
    expect(frontZIndex(LIVED_IN, 'pinned-old')).toBeNull();
  });

  it('呼び出し側の採番（floor）より必ず上を返す（連続で押しても戻らない）', () => {
    // PC は自前の採番を持っている。盤面の最大値より大きければそちらを尊重する。
    expect(frontZIndex(LIVED_IN, 'auto-1', 900)).toBe(901);
  });

  it('floor より上にいる最前面のカードは動かさない', () => {
    expect(frontZIndex(LIVED_IN, 'pinned-old', 100)).toBeNull();
  });

  it('知らない id は null（消えた直後のカードを押しても落ちない）', () => {
    expect(frontZIndex(LIVED_IN, 'missing')).toBeNull();
  });

  it('1 枚だけの盤面では何もしない', () => {
    expect(frontZIndex([card('only', 3)], 'only')).toBeNull();
  });

  it('同じ z が並んでいても、押したカードは必ず上に出る', () => {
    const tied = [card('a', 7), card('b', 7)];
    expect(frontZIndex(tied, 'a')).toBe(8);
  });
});

describe('raiseToFront', () => {
  it('押したカードだけを前面へ出し、利用者が置いた印を付ける', () => {
    const next = raiseToFront(LIVED_IN, 'auto-1');
    expect(next).not.toBeNull();
    const raised = next?.find((c) => c.id === 'auto-1');
    expect(raised?.zIndex).toBe(501);
    expect(raised?.userPositioned).toBe(true);
    // 他のカードは触らない
    expect(next?.find((c) => c.id === 'pinned-old')?.zIndex).toBe(500);
  });

  it('既に最前面なら null（呼び出し側は何もしない）', () => {
    expect(raiseToFront(LIVED_IN, 'pinned-old')).toBeNull();
  });
});
