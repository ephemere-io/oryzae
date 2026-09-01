import { describe, expect, it } from 'vitest';
import { measureTitle, TITLE_MIN_FONT_SIZE } from '@/features/pc/entries/utils/title-metrics';

/**
 * 題の字数に上限を設けない代わりに、**どんな長さでも桁に収まる**ことをここで保証する。
 * 収まらなければ見切れる（実際に 200 字で見切れていた）。
 *
 * 桁に入る字数 = floor(columnHeight * 0.94 / fontSize)。以下はその式で検算している。
 */
describe('measureTitle', () => {
  const BASE = 32;
  const HEIGHT = 588; // 実測値（1512×900 の画面）

  /** その寸法で本当に収まるか。収まらなければ見切れる。 */
  function fits(length: number, columnHeight = HEIGHT, baseFontSize = BASE) {
    const { fontSize, columns } = measureTitle({ length, baseFontSize, columnHeight });
    const perColumn = Math.floor((columnHeight * 0.94) / fontSize);
    return { fontSize, columns, fits: length <= perColumn * columns };
  }

  it('短い題は本文と同じ大きさ・1桁', () => {
    const m = measureTitle({ length: 3, baseFontSize: BASE, columnHeight: HEIGHT });
    expect(m).toEqual({ fontSize: BASE, columns: 1 });
  });

  it('1桁に入り切らなければ、縮めるのではなく桁を増やす', () => {
    // 588*0.94/32 = 17 字が1桁の上限
    expect(measureTitle({ length: 18, baseFontSize: BASE, columnHeight: HEIGHT })).toEqual({
      fontSize: BASE,
      columns: 2,
    });
    expect(measureTitle({ length: 40, baseFontSize: BASE, columnHeight: HEIGHT })).toEqual({
      fontSize: BASE,
      columns: 3,
    });
  });

  it('題は本文より大きくならない', () => {
    const m = measureTitle({ length: 1, baseFontSize: BASE, columnHeight: HEIGHT });
    expect(m.fontSize).toBeLessThanOrEqual(BASE);
  });

  it('3桁でも入らなくなったら字を縮める', () => {
    const m = fits(80);
    expect(m.fontSize).toBeLessThan(BASE);
    expect(m.columns).toBe(3);
    expect(m.fits).toBe(true);
  });

  it('下限まで縮めてなお入らなければ、さらに桁を増やす', () => {
    // ここを持たないと 200 字が下限の字でも3桁に入らず、そのまま見切れる。
    const m = fits(200);
    expect(m.fontSize).toBe(TITLE_MIN_FONT_SIZE);
    expect(m.columns).toBeGreaterThan(3);
    expect(m.fits).toBe(true);
  });

  it('題として現実的な長さは、どれも桁に収まる（見切れない）', () => {
    for (const length of [1, 3, 10, 17, 18, 40, 41, 80, 120, 200, 400, 550]) {
      expect(fits(length), `${length}字`).toMatchObject({ fits: true });
    }
  });

  it('画面が低いときも収まる', () => {
    for (const length of [1, 10, 40, 120]) {
      expect(fits(length, 300), `${length}字 / 低い画面`).toMatchObject({ fits: true });
    }
  });

  it('高さがまだ測れていなければ、本文と同じ大きさの1桁に倒す', () => {
    expect(measureTitle({ length: 40, baseFontSize: BASE, columnHeight: 0 })).toEqual({
      fontSize: BASE,
      columns: 1,
    });
  });

  it('空の題でも 1 文字ぶんの箱を持つ（0 除算しない）', () => {
    const m = measureTitle({ length: 0, baseFontSize: BASE, columnHeight: HEIGHT });
    expect(m).toEqual({ fontSize: BASE, columns: 1 });
  });
});
