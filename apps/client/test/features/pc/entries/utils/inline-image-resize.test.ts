import type { InlineImage } from '@oryzae/shared';
import { describe, expect, it } from 'vitest';
import {
  isCornerHandle,
  type ResizeHandle,
  resizeInlineImage,
} from '@/features/pc/entries/utils/inline-image-resize';

const START: InlineImage = {
  offset: 0,
  storagePath: 'p',
  widthRatio: 0.4,
};

/** 行の長さ 1000px、写真は inline 400px × block 300px（4:3）から始める。 */
function resize(over: Partial<Parameters<typeof resizeInlineImage>[0]>) {
  return resizeInlineImage({
    start: START,
    handle: 'se',
    dx: 0,
    dy: 0,
    editorInlineSize: 1000,
    startInlinePx: 400,
    startBlockPx: 300,
    isVertical: false,
    ...over,
  });
}

describe('isCornerHandle', () => {
  it('角の4つだけを角として扱う', () => {
    const corners: ResizeHandle[] = ['nw', 'ne', 'se', 'sw'];
    const edges: ResizeHandle[] = ['n', 'e', 's', 'w'];
    expect(corners.every(isCornerHandle)).toBe(true);
    expect(edges.some(isCornerHandle)).toBe(false);
  });
});

describe('resizeInlineImage（横書き）', () => {
  it('右下を右へ引くと大きくなる', () => {
    // 400px → 500px = 行の 50%
    expect(resize({ handle: 'se', dx: 100 }).widthRatio).toBeCloseTo(0.5);
  });

  it('左上を右へ引くと小さくなる（掴んだ向きと逆）', () => {
    expect(resize({ handle: 'nw', dx: 100 }).widthRatio).toBeCloseTo(0.3);
  });

  it('角ハンドルは縦横比を変えない', () => {
    expect(resize({ handle: 'se', dx: 100 }).aspect).toBeUndefined();
  });

  it('辺（東）は inline だけ伸ばし、比率を確定させる', () => {
    const result = resize({ handle: 'e', dx: 100 });

    expect(result.widthRatio).toBeCloseTo(0.5);
    // block 300px は据え置きなので 300/500 = 0.6
    expect(result.aspect).toBeCloseTo(0.6);
  });

  it('辺（南）は block だけ伸ばす（幅は変わらない）', () => {
    const result = resize({ handle: 's', dy: 150 });

    expect(result.widthRatio).toBeCloseTo(0.4);
    // block 300 → 450、inline 400 のままなので 450/400
    expect(result.aspect).toBeCloseTo(1.125);
  });
});

/**
 * 縦書きでは inline 軸が画面の Y、block 軸が画面の X（しかも右→左）。
 * ここを取り違えると「右へ引いたのに縦に伸びる」「逆向きに縮む」になる。
 */
describe('resizeInlineImage（縦書き）', () => {
  it('下へ引くと大きくなる（inline 軸が画面の Y）', () => {
    const result = resize({ isVertical: true, handle: 'se', dy: 100 });
    expect(result.widthRatio).toBeCloseTo(0.5);
  });

  it('横へ引いても inline 幅は変わらない（角）', () => {
    const result = resize({ isVertical: true, handle: 'se', dx: 100 });
    expect(result.widthRatio).toBeCloseTo(0.4);
  });

  it('辺（南）は縦書きでは inline を伸ばす', () => {
    const result = resize({ isVertical: true, handle: 's', dy: 100 });

    expect(result.widthRatio).toBeCloseTo(0.5);
    expect(result.aspect).toBeCloseTo(0.6);
  });

  // 縦書きは行が右から左へ進むので、block 軸は左方向が「伸びる」。
  it('辺（西）を左へ引くと block が伸びる', () => {
    const result = resize({ isVertical: true, handle: 'w', dx: -150 });

    expect(result.widthRatio).toBeCloseTo(0.4);
    expect(result.aspect).toBeCloseTo(1.125);
  });
});

describe('resizeInlineImage の下限・上限', () => {
  it('行幅を超えて広げられない', () => {
    expect(resize({ handle: 'se', dx: 5000 }).widthRatio).toBe(1);
  });

  it('潰れて掴めなくなる手前で止まる', () => {
    expect(resize({ handle: 'se', dx: -5000 }).widthRatio).toBe(0.05);
  });

  // 初期化前などで実寸が取れないことがある。そこで NaN を返すと写真が消える。
  it('実寸が取れないときは元の値を返す', () => {
    expect(resize({ startInlinePx: 0, dx: 100 })).toEqual({ widthRatio: 0.4 });
    expect(resize({ editorInlineSize: 0, dx: 100 })).toEqual({ widthRatio: 0.4 });
  });
});
