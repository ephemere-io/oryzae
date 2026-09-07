import { describe, expect, it } from 'vitest';
import { defaultWidthRatio } from '@/features/pc/entries/utils/inline-image-placement';

/**
 * 規則は1本だけ:「写真の長辺が行と同じ向きなら 80%、行を横切るなら 50%」。
 * 縦書き・横書きの4通りを、レビューで指定された値そのもので固定する。
 */
describe('defaultWidthRatio', () => {
  const PORTRAIT = 1600 / 1200; // 高さ ÷ 幅 = 1.33（縦長）
  const LANDSCAPE = 1200 / 1600; // 0.75（横長）

  it('横書きの横長は横幅 80%（行と同じ向き）', () => {
    expect(defaultWidthRatio(LANDSCAPE, false)).toBe(0.8);
  });

  it('横書きの縦長は横幅 50%（行を横切る）', () => {
    expect(defaultWidthRatio(PORTRAIT, false)).toBe(0.5);
  });

  it('縦書きの縦長は縦幅 80%（行と同じ向き）', () => {
    expect(defaultWidthRatio(PORTRAIT, true)).toBe(0.8);
  });

  it('縦書きの横長は縦幅 50%（行を横切る）', () => {
    expect(defaultWidthRatio(LANDSCAPE, true)).toBe(0.5);
  });

  it('正方形は行を横切る側に倒す（どちらの向きでも紙を覆わない）', () => {
    expect(defaultWidthRatio(1, false)).toBe(0.5);
    expect(defaultWidthRatio(1, true)).toBe(0.5);
  });

  it('測れなかった写真は紙を守る側に倒す', () => {
    for (const broken of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(defaultWidthRatio(broken, false)).toBe(0.5);
      expect(defaultWidthRatio(broken, true)).toBe(0.5);
    }
  });
});
