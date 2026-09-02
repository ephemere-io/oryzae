import { describe, expect, it } from 'vitest';
import { measureTitle, TITLE_MIN_FONT_SIZE } from '@/features/pc/entries/utils/title-metrics';

/**
 * 題の字数に上限を設けない代わりに、**紙を占領しないこと**をここで保証する。
 * 筋（縦書きなら桁、横書きなら行）は最大3本まで。それを超えるぶんは字を落とす。
 *
 * 1筋に入る字数 = floor(lineLength * 0.94 / fontSize)。以下はその式で検算している。
 */
describe('measureTitle', () => {
  const BASE = 32;
  const LINE = 588; // 実測値（1512×900 の画面での桁の高さ）

  /** その寸法で本当に収まるか。収まらなければ見切れる。 */
  function fit(length: number, lineLength = LINE, baseFontSize = BASE) {
    const { fontSize, lines } = measureTitle({ length, baseFontSize, lineLength });
    const perLine = Math.floor((lineLength * 0.94) / fontSize);
    return { fontSize, lines, fits: length <= perLine * lines };
  }

  it('短い題は本文と同じ大きさ・1筋', () => {
    expect(measureTitle({ length: 3, baseFontSize: BASE, lineLength: LINE })).toEqual({
      fontSize: BASE,
      lines: 1,
    });
  });

  it('1筋に入り切らなければ、縮めるのではなく筋を増やす', () => {
    // 588*0.94/32 = 17 字が1筋の上限
    expect(measureTitle({ length: 18, baseFontSize: BASE, lineLength: LINE })).toEqual({
      fontSize: BASE,
      lines: 2,
    });
    expect(measureTitle({ length: 40, baseFontSize: BASE, lineLength: LINE })).toEqual({
      fontSize: BASE,
      lines: 3,
    });
  });

  it('題は本文より大きくならない', () => {
    expect(measureTitle({ length: 1, baseFontSize: BASE, lineLength: LINE }).fontSize).toBe(BASE);
  });

  it('**筋は3本を超えない**（長い題が紙の面積を占領しない）', () => {
    for (const length of [40, 80, 200, 500]) {
      expect(fit(length).lines, `${length}字`).toBeLessThanOrEqual(3);
    }
  });

  it('3筋でも入らなくなったら字を落とす', () => {
    const m = fit(80);
    expect(m.fontSize).toBeLessThan(BASE);
    expect(m.lines).toBe(3);
    expect(m.fits).toBe(true);
  });

  it('題として現実的な長さは、3筋に収まる（見切れない）', () => {
    for (const length of [1, 3, 10, 17, 18, 40, 41, 80, 120, 165]) {
      expect(fit(length), `${length}字`).toMatchObject({ fits: true });
    }
  });

  it('下限より小さくはしない（読めなくなるので、そこからは見切れる）', () => {
    const m = fit(1000);
    expect(m.fontSize).toBe(TITLE_MIN_FONT_SIZE);
    expect(m.fits).toBe(false);
  });

  it('横書きでも同じ規則（筋の長さが行の幅になるだけ）', () => {
    // 1行 1088px / 本文 32px の 1.3 倍 = 41px → 1行 24 字
    const m = measureTitle({ length: 30, baseFontSize: 41, lineLength: 1088 });
    expect(m).toEqual({ fontSize: 41, lines: 2 });
  });

  it('画面が低い（狭い）ときも3筋に収まる', () => {
    for (const length of [1, 10, 40, 80]) {
      expect(fit(length, 300), `${length}字 / 短い筋`).toMatchObject({ fits: true });
    }
  });

  it('長さがまだ測れていなければ、本文と同じ大きさの1筋に倒す', () => {
    expect(measureTitle({ length: 40, baseFontSize: BASE, lineLength: 0 })).toEqual({
      fontSize: BASE,
      lines: 1,
    });
  });

  it('空の題でも 1 文字ぶんの箱を持つ（0 除算しない）', () => {
    expect(measureTitle({ length: 0, baseFontSize: BASE, lineLength: LINE })).toEqual({
      fontSize: BASE,
      lines: 1,
    });
  });
});
