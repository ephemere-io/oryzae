import { describe, expect, it } from 'vitest';
import {
  normalizeDegrees,
  resizeFromHandle,
} from '@/features/sp/board/components/sp-board-surface';

/**
 * 角のつまみ 1 つで回転と拡大縮小を同時に扱う計算。
 * SP に 2 種類のつまみを並べると、どちらも指より小さくなって掴み分けられない。
 */

const BASE = {
  startAngle: 0,
  startDistance: 100,
  startRotation: 0,
  startWidth: 200,
  startHeight: 100,
};

describe('resizeFromHandle', () => {
  it('掴んだまま動かさなければ何も変わらない', () => {
    expect(resizeFromHandle({ ...BASE, angle: 0, distance: 100 })).toEqual({
      rotation: 0,
      width: 200,
      height: 100,
    });
  });

  it('遠ざけると大きく、近づけると小さくなる', () => {
    expect(resizeFromHandle({ ...BASE, angle: 0, distance: 200 }).width).toBe(400);
    expect(resizeFromHandle({ ...BASE, angle: 0, distance: 50 }).width).toBe(100);
  });

  it('縦横の比を変えない（写真が引き伸ばされない）', () => {
    const next = resizeFromHandle({ ...BASE, angle: 0, distance: 150 });
    expect(next.width / next.height).toBeCloseTo(BASE.startWidth / BASE.startHeight, 10);
  });

  it('指の向きの差だけカードが回る', () => {
    const next = resizeFromHandle({ ...BASE, angle: Math.PI / 2, distance: 100 });
    expect(next.rotation).toBeCloseTo(90, 5);
  });

  it('掴んだ瞬間の回転から積み上げる（0 に戻さない）', () => {
    const next = resizeFromHandle({
      ...BASE,
      startRotation: 30,
      angle: Math.PI / 6,
      distance: 100,
    });
    expect(next.rotation).toBeCloseTo(60, 3);
  });

  it('小さくしすぎない（掴めなくなる）', () => {
    const next = resizeFromHandle({ ...BASE, angle: 0, distance: 1 });
    expect(next.width).toBeGreaterThanOrEqual(60);
    expect(next.height).toBeGreaterThanOrEqual(60);
  });

  it('掴んだ距離が 0 でも落ちない（中心をそのまま掴んだ場合）', () => {
    const next = resizeFromHandle({ ...BASE, startDistance: 0, angle: 0, distance: 50 });
    expect(next.width).toBe(200);
    expect(next.height).toBe(100);
  });
});

describe('normalizeDegrees', () => {
  it('-180..180 に畳む', () => {
    expect(normalizeDegrees(0)).toBe(0);
    expect(normalizeDegrees(90)).toBe(90);
    expect(normalizeDegrees(-90)).toBe(-90);
    expect(normalizeDegrees(270)).toBe(-90);
    expect(normalizeDegrees(-270)).toBe(90);
  });

  it('何周しても値が増え続けない（保存した数字が読めなくなる）', () => {
    expect(normalizeDegrees(360 * 5 + 45)).toBeCloseTo(45, 5);
    expect(Math.abs(normalizeDegrees(360 * 100 + 10))).toBeLessThanOrEqual(180);
  });

  it('小数第1位まで（保存する値を無駄に長くしない）', () => {
    expect(normalizeDegrees(12.3456)).toBe(12.3);
  });

  it('壊れた値は 0 に倒す', () => {
    expect(normalizeDegrees(Number.NaN)).toBe(0);
    expect(normalizeDegrees(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
