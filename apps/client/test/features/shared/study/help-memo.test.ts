import { describe, expect, it } from 'vitest';
import {
  MEMO_BASE_PX_PER_UNIT,
  MEMO_LINKS,
  MEMO_SCALE_RANGE,
  MEMO_TORN_EDGE,
  MEMO_WIDTH,
  memoPose,
  memoScale,
  showsCaptions,
} from '@/features/shared/study/help-memo';

describe('壁のメモの行き先', () => {
  it('ヘルプ・お問い合わせ・Docs の 3 つをこの順で持つ', () => {
    expect(MEMO_LINKS.map((link) => link.id)).toEqual(['help', 'contact', 'docs']);
  });

  it('お問い合わせはヘルプと同じページの節を指す（独立したページにしない）', () => {
    // 使い方・よくある質問・お問い合わせは公開サイトの /support に 1 枚でまとめてある。
    const help = MEMO_LINKS.find((link) => link.id === 'help');
    const contact = MEMO_LINKS.find((link) => link.id === 'contact');
    expect(help?.path).toBe('/support');
    expect(contact?.path).toBe('/support#contact');
  });

  it('Docs は公開サイトのトップ（LP）を指す', () => {
    expect(MEMO_LINKS.find((link) => link.id === 'docs')?.path).toBe('/');
  });

  it('パスはすべて公開サイトの相対パス（絶対 URL は docsHref が付ける）', () => {
    for (const link of MEMO_LINKS) {
      expect(link.path.startsWith('/')).toBe(true);
      expect(link.path.startsWith('http')).toBe(false);
    }
  });

  it('鍵はすべて study 配下の memo_* を指す', () => {
    for (const link of MEMO_LINKS) {
      expect(link.captionKey).toMatch(/^memo_[a-z]+_caption$/);
      expect(link.labelKey).toMatch(/^memo_[a-z]+$/);
    }
  });
});

describe('memoScale — 壁の紙は遠近で大きさが変わる', () => {
  it('自然寸を決めた尺では等倍', () => {
    expect(memoScale(MEMO_BASE_PX_PER_UNIT)).toBeCloseTo(1, 5);
  });

  it('寄ると尺に比例して大きくなる', () => {
    expect(memoScale(MEMO_BASE_PX_PER_UNIT * 1.5)).toBeCloseTo(1.5, 5);
  });

  it('小さい画面で忠実に縮めず、読める下限で止める', () => {
    // 高さ 640px の画面では尺が 46 ほどになり、そのままだと 9px の字が 6px になる。
    expect(memoScale(46)).toBe(MEMO_SCALE_RANGE.min);
    expect(memoScale(1)).toBe(MEMO_SCALE_RANGE.min);
  });

  it('寄り切っても紙で画面を埋めない', () => {
    expect(memoScale(MEMO_BASE_PX_PER_UNIT * 10)).toBe(MEMO_SCALE_RANGE.max);
  });

  it('尺が壊れていても（0・負・NaN）読める下限で出す', () => {
    expect(memoScale(0)).toBe(MEMO_SCALE_RANGE.min);
    expect(memoScale(-5)).toBe(MEMO_SCALE_RANGE.min);
    expect(memoScale(Number.NaN)).toBe(MEMO_SCALE_RANGE.min);
  });
});

describe('面ごとの見せ方', () => {
  it('壁の紙は一言つき、机の紙は名前だけ（幅が無い）', () => {
    expect(showsCaptions('wall')).toBe(true);
    expect(showsCaptions('desk')).toBe(false);
    expect(MEMO_WIDTH.desk).toBeLessThan(MEMO_WIDTH.wall);
  });

  it('どちらも中心合わせと尺のあとに傾く', () => {
    for (const surface of ['wall', 'desk'] as const) {
      const pose = memoPose(surface, 1.25);
      expect(pose.startsWith('translate(-50%, -50%) scale(1.25)')).toBe(true);
      expect(pose).toMatch(/rotate\(-?[\d.]+deg\)$/);
    }
  });

  it('壁の紙は正対し、机の紙は奥へ倒して寝かせる', () => {
    expect(memoPose('wall', 1)).not.toContain('rotateX(');
    const desk = memoPose('desk', 1);
    expect(desk).toContain('perspective(');
    expect(desk).toMatch(/rotateX\([1-9]\d?deg\)/);
    // perspective は rotateX より先に無いと効かない。
    expect(desk.indexOf('perspective(')).toBeLessThan(desk.indexOf('rotateX('));
  });
});

describe('破れた下辺', () => {
  it('上辺と左右は真っ直ぐ（破れているのは下だけ）', () => {
    expect(MEMO_TORN_EDGE.startsWith('polygon(0 0, 100% 0, ')).toBe(true);
    expect(MEMO_TORN_EDGE.endsWith('0 98%)')).toBe(true);
  });

  it('下辺の点はすべて 94% より下にある（紙の本文を削らない）', () => {
    const points = MEMO_TORN_EDGE.replace(/^polygon\(|\)$/g, '')
      .split(',')
      .map((pair) => pair.trim().split(/\s+/))
      .slice(2);
    for (const [, y] of points) {
      const value = Number.parseFloat(y ?? '');
      expect(value).toBeGreaterThanOrEqual(94);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
