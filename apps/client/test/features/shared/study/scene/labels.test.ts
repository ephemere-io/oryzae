import { describe, expect, it } from 'vitest';
import {
  clampPillToScreen,
  jarPillStateKey,
  LABEL_STYLE,
  PILL_MIN_HEIGHT,
} from '@/features/shared/study/scene/labels';

/** 390×844（iPhone 14 相当）と 390×640（縦の短い端末）の両方で見る。 */
const TALL = { width: 390, height: 844 };
const SHORT = { width: 390, height: 640 };
const PILL = { width: 132, height: PILL_MIN_HEIGHT };

describe('PILL_MIN_HEIGHT', () => {
  it('タッチの下限 44px を満たす', () => {
    expect(PILL_MIN_HEIGHT).toBeGreaterThanOrEqual(44);
  });
});

describe('clampPillToScreen', () => {
  it('画面の内側なら投影位置にオフセットを足すだけ', () => {
    const placed = clampPillToScreen({ x: 200, y: 400 }, { x: -28, y: 26 }, PILL, TALL);
    expect(placed).toEqual({ x: 172, y: 426 });
  });

  it.each([TALL, SHORT])('$width×$height: 左右にはみ出しても内側へ押し戻す', (screen) => {
    const left = clampPillToScreen({ x: -500, y: 300 }, { x: 0, y: 0 }, PILL, screen);
    const right = clampPillToScreen({ x: 5000, y: 300 }, { x: 0, y: 0 }, PILL, screen);

    // ピルの全体が画面に収まっていること。
    expect(left.x - PILL.width / 2).toBeGreaterThanOrEqual(0);
    expect(right.x + PILL.width / 2).toBeLessThanOrEqual(screen.width);
  });

  it.each([TALL, SHORT])('$width×$height: 上下にはみ出しても内側へ押し戻す', (screen) => {
    const top = clampPillToScreen({ x: 200, y: -300 }, { x: 0, y: 0 }, PILL, screen);
    const bottom = clampPillToScreen({ x: 200, y: 9999 }, { x: 0, y: 0 }, PILL, screen);

    expect(top.y - PILL.height / 2).toBeGreaterThanOrEqual(0);
    expect(bottom.y + PILL.height / 2).toBeLessThanOrEqual(screen.height);
  });

  it('オフセットで画面外へ出る場合も押し戻す', () => {
    // BOARD のオフセットは (-92, +40)。画面左端近くの投影だと外へ出る。
    const placed = clampPillToScreen({ x: 40, y: 120 }, { x: -92, y: 40 }, PILL, TALL);
    expect(placed.x - PILL.width / 2).toBeGreaterThanOrEqual(0);
  });

  it('ピルが画面より大きいときは中央に置く（上下限の逆転で壊れない）', () => {
    const tiny = { width: 100, height: 60 };
    const placed = clampPillToScreen({ x: 0, y: 0 }, { x: 0, y: 0 }, PILL, tiny);
    expect(placed).toEqual({ x: 50, y: 30 });
  });

  it('投影が NaN でも画面内に収まる', () => {
    const placed = clampPillToScreen({ x: Number.NaN, y: Number.NaN }, { x: 0, y: 0 }, PILL, TALL);
    expect(Number.isFinite(placed.x)).toBe(true);
    expect(Number.isFinite(placed.y)).toBe(true);
  });
});

describe('jarPillStateKey', () => {
  it('状態語が瓶の様子と対応する', () => {
    expect(jarPillStateKey('idle', 0)).toBe('pill_jar_empty');
    expect(jarPillStateKey('fermenting', 0.4)).toBe('pill_jar_fermenting');
    expect(jarPillStateKey('completed', 1)).toBe('pill_jar_letter');
  });

  it('readiness 0.9 以上で「もうすぐ」', () => {
    expect(jarPillStateKey('fermenting', 0.89)).toBe('pill_jar_fermenting');
    expect(jarPillStateKey('fermenting', 0.9)).toBe('pill_jar_almost');
  });

  it('手紙が届いていれば readiness より優先する', () => {
    expect(jarPillStateKey('completed', 0.2)).toBe('pill_jar_letter');
  });
});

describe('LABEL_STYLE', () => {
  it('PC の既定は控えめ、ホバーで濃くなる', () => {
    expect(LABEL_STYLE.restOpacity).toBeLessThan(LABEL_STYLE.hoverOpacity);
    expect(LABEL_STYLE.restOpacity).toBe(0.5);
    expect(LABEL_STYLE.hoverOpacity).toBe(1);
  });

  it('点はラベルより小さい（ほのかな手掛かりに留める）', () => {
    expect(LABEL_STYLE.dotSize).toBeLessThan(LABEL_STYLE.fontSize);
  });
});
