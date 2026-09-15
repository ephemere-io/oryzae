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
  layout: 'inline',
  align: 'start',
};

/** 行の長さ 1000px、写真は画面上で 幅 400 × 高さ 300（4:3）から始める。 */
function resize(over: Partial<Parameters<typeof resizeInlineImage>[0]>) {
  return resizeInlineImage({
    start: START,
    handle: 'se',
    dx: 0,
    dy: 0,
    editorInlineSize: 1000,
    startWidthPx: 400,
    startHeightPx: 300,
    isVertical: false,
    ...over,
  });
}

/** 縦書き。行の長さ 1000px（＝ editor の高さ）、写真は 幅 300 × 高さ 400。 */
function resizeVertical(over: Partial<Parameters<typeof resizeInlineImage>[0]>) {
  return resize({ isVertical: true, startWidthPx: 300, startHeightPx: 400, ...over });
}

describe('isCornerHandle', () => {
  it('角の4つだけを角として扱う', () => {
    const corners: ResizeHandle[] = ['nw', 'ne', 'se', 'sw'];
    const edges: ResizeHandle[] = ['n', 'e', 's', 'w'];
    expect(corners.every(isCornerHandle)).toBe(true);
    expect(edges.some(isCornerHandle)).toBe(false);
  });
});

/**
 * **掴んだ辺を外へ引けば大きく、内へ引けば小さく。** ここが崩れると
 * 「右へ引いたのに左へ潰れる」になる（実際にそうなっていた）。
 */
describe('掴んだ向きと伸び方', () => {
  it('右の辺を右へ引くと幅が増える', () => {
    // 400px → 500px = 行の 50%
    expect(resize({ handle: 'e', dx: 100 }).widthRatio).toBeCloseTo(0.5);
  });

  it('左の辺を左へ引いても幅が増える（外へ引けば大きい）', () => {
    expect(resize({ handle: 'w', dx: -100 }).widthRatio).toBeCloseTo(0.5);
  });

  it('右の辺を左へ引くと幅が減る', () => {
    expect(resize({ handle: 'e', dx: -100 }).widthRatio).toBeCloseTo(0.3);
  });

  it('縦書きでも、右の辺を右へ引けば幅が増える（行の割合は高さなので変わらない）', () => {
    const result = resizeVertical({ handle: 'e', dx: 100 });

    // 行に対する割合＝高さ 400px は動かない。
    expect(result.widthRatio).toBeCloseTo(0.4);
    // 幅 300 → 400、高さ 400 のままなので 1:1。
    expect(result.aspect).toBeCloseTo(1);
  });

  it('縦書きで左の辺を左へ引いても幅が増える', () => {
    expect(resizeVertical({ handle: 'w', dx: -100 }).aspect).toBeCloseTo(1);
  });
});

describe('形（aspect）の扱い', () => {
  it('角ハンドルは形を変えない', () => {
    expect(resize({ handle: 'se', dx: 100 }).aspect).toBeUndefined();
  });

  it('角ハンドルは行に沿う辺の伸びで全体を拡げる', () => {
    expect(resize({ handle: 'se', dx: 100 }).widthRatio).toBeCloseTo(0.5);
    expect(resize({ handle: 'nw', dx: 100 }).widthRatio).toBeCloseTo(0.3);
  });

  it('縦書きの角ハンドルは、縦のドラッグで拡げる（横は形を保つので見ない）', () => {
    expect(resizeVertical({ handle: 'se', dy: 100 }).widthRatio).toBeCloseTo(0.5);
    expect(resizeVertical({ handle: 'se', dx: 100 }).widthRatio).toBeCloseTo(0.4);
  });

  it('辺ハンドルは掴んだ軸だけを伸ばす（もう片方は動かない）', () => {
    // 下の辺を下へ 150px。高さ 300 → 450、幅 400 は据え置き。
    const result = resize({ handle: 's', dy: 150 });

    expect(result.widthRatio).toBeCloseTo(0.4); // 幅は変わらない
    expect(result.aspect).toBeCloseTo(400 / 450);
  });

  it('保存する形は「幅 ÷ 高さ」（画面で見たままの比）', () => {
    const result = resize({ handle: 'e', dx: 100 });
    expect(result.aspect).toBeCloseTo(500 / 300);
  });

  it('縦書きで下の辺を下へ引くと、高さだけが伸びる', () => {
    const result = resizeVertical({ handle: 's', dy: 100 });

    expect(result.widthRatio).toBeCloseTo(0.5); // 高さ 400 → 500 = 行の 50%
    expect(result.aspect).toBeCloseTo(300 / 500); // 幅 300 は据え置き
  });
});

describe('下限・上限', () => {
  it('行幅を超えて広げられない', () => {
    expect(resize({ handle: 'se', dx: 5000 }).widthRatio).toBe(1);
  });

  it('潰れて掴めなくなる手前で止まる', () => {
    expect(resize({ handle: 'se', dx: -5000 }).widthRatio).toBe(0.05);
  });

  // 行幅で頭打ちになったとき、形をドラッグ量から出すと高さだけが飛ぶ。
  it('行幅で止まったとき、形は止まった幅から出す', () => {
    const result = resize({ handle: 'e', dx: 5000 });

    expect(result.widthRatio).toBe(1);
    expect(result.aspect).toBeCloseTo(1000 / 300);
  });

  // 初期化前などで実寸が取れないことがある。そこで NaN を返すと写真が消える。
  it('実寸が取れないときは元の値を返す', () => {
    expect(resize({ startWidthPx: 0, dx: 100 })).toEqual({ widthRatio: 0.4 });
    expect(resize({ startHeightPx: 0, dx: 100 })).toEqual({ widthRatio: 0.4 });
    expect(resize({ editorInlineSize: 0, dx: 100 })).toEqual({ widthRatio: 0.4 });
  });
});
