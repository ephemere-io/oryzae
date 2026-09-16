import { describe, expect, it } from 'vitest';
import { snippetFontSize } from '@/features/shared/board/card-text';

describe('snippetFontSize', () => {
  it('既定の幅では基準の大きさのまま（PC 14px / SP 17px）', () => {
    expect(snippetFontSize(262, 14)).toBe(14);
    expect(snippetFontSize(262, 17)).toBe(17);
  });

  it('枠を広げると文字も大きくなる', () => {
    // 幅が倍なら文字も倍。カードを大きくする操作が「読みやすくする」に繋がる。
    expect(snippetFontSize(524, 14)).toBe(28);
    expect(snippetFontSize(393, 14)).toBe(21);
  });

  it('上限で止まる（1 枚が見出しにならない）', () => {
    expect(snippetFontSize(5000, 17)).toBe(44);
  });

  it('下限で止まる（小さくしても読める大きさを残す）', () => {
    expect(snippetFontSize(60, 14)).toBe(12);
  });

  it('壊れた幅なら基準をそのまま返す（文字が消えない）', () => {
    expect(snippetFontSize(0, 14)).toBe(14);
    expect(snippetFontSize(Number.NaN, 17)).toBe(17);
    expect(snippetFontSize(-100, 14)).toBe(14);
  });
});
