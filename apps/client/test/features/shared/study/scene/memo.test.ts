import { describe, expect, it } from 'vitest';
import {
  MEMO_FONT,
  MEMO_HIT,
  MEMO_PAPER,
  MEMO_PIN,
  MEMO_TEXT,
  MEMO_TEXT_DROP,
  MEMO_TILT,
  memoHitSize,
  memoLineWidth,
  memoLineYs,
  paperOutline,
} from '@/features/shared/study/scene/memo';

const SURFACES = ['wall', 'desk'] as const;

describe('紙の輪郭（paperOutline）', () => {
  it.each(SURFACES)('%s: 四隅だけの真っ直ぐな矩形（破れも角の丸みも無い）', (surface) => {
    const size = MEMO_PAPER[surface];
    const points = paperOutline(size);
    const halfW = size.width / 2;
    const halfH = size.height / 2;
    expect(points).toEqual([
      { x: -halfW, y: halfH },
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
    ]);
  });

  it('壁の紙は縦長（メモ用紙の比）', () => {
    expect(MEMO_PAPER.wall.height).toBeGreaterThan(MEMO_PAPER.wall.width);
  });
});

describe('行の置き方', () => {
  it('3 行を縦中央に均等に置く', () => {
    expect(memoLineYs(3, 0.5)).toEqual([0.5, 0, -0.5]);
  });

  it('画鋲のぶん下げられる', () => {
    const ys = memoLineYs(3, 0.5, 0.1);
    expect(ys[0]).toBeCloseTo(0.4, 10);
    expect(ys[1]).toBeCloseTo(-0.1, 10);
    expect(ys[2]).toBeCloseTo(-0.6, 10);
  });

  it('1 行なら中央、0 行なら空', () => {
    expect(memoLineYs(1, 0.5)).toEqual([0]);
    expect(memoLineYs(0, 0.5)).toEqual([]);
    expect(memoLineYs(-2, 0.5)).toEqual([]);
  });

  it.each(SURFACES)('%s: 3 行が紙の中に収まり、画鋲と重ならない', (surface) => {
    const paper = MEMO_PAPER[surface];
    const text = MEMO_TEXT[surface];
    const ys = memoLineYs(3, text.gap, MEMO_TEXT_DROP[surface]);
    const top = (ys[0] ?? 0) + text.lineHeight / 2;
    const bottom = (ys[2] ?? 0) - text.lineHeight / 2;
    const pinBottom = paper.height / 2 - MEMO_PIN.fromTop - MEMO_PIN.radius;
    expect(top).toBeLessThan(surface === 'wall' ? pinBottom : paper.height / 2);
    expect(bottom).toBeGreaterThan(-paper.height / 2 + 0.15);
  });

  it('文字の面は縦横比を保つ（全行同幅にしない）', () => {
    expect(memoLineWidth({ width: 400, height: 100 }, 0.24)).toBeCloseTo(0.96, 6);
    expect(memoLineWidth({ width: 100, height: 100 }, 0.24)).toBeCloseTo(0.24, 6);
    expect(memoLineWidth({ width: 0, height: 0 }, 0.24)).toBe(0);
  });

  it.each(SURFACES)('%s: いちばん長い行（お問い合わせ 6 文字）が紙の幅に入る', (surface) => {
    const paper = MEMO_PAPER[surface];
    const text = MEMO_TEXT[surface];
    // 全角 6 文字 ＋ 左右の余白（createTextTexture が 0.4em 足す）≈ 6.4em。
    const width = memoLineWidth({ width: 6.4, height: 1.4 }, text.lineHeight);
    expect(text.inset + width).toBeLessThan(paper.width - text.inset * 0.5);
  });
});

describe('当たりの箱', () => {
  it.each(SURFACES)('%s: 行の間で指がすり抜けない高さ（行間の 9 割以上）', (surface) => {
    const [, height] = memoHitSize(surface);
    expect(height).toBeGreaterThanOrEqual(MEMO_TEXT[surface].gap * 0.9);
    expect(height).toBeLessThan(MEMO_TEXT[surface].gap);
  });

  it.each(SURFACES)('%s: 幅は紙の幅の内側、奥行きは紙より厚い', (surface) => {
    const [width, , depth] = memoHitSize(surface);
    expect(width).toBeLessThan(MEMO_PAPER[surface].width);
    expect(width).toBeGreaterThan(MEMO_PAPER[surface].width * 0.7);
    expect(depth).toBe(MEMO_HIT.depth);
  });
});

describe('姿勢と書体', () => {
  it('壁の紙は真っ直ぐ、机の紙だけ置いたなりにわずかに回る', () => {
    expect(MEMO_TILT.wall).toBe(0);
    expect(MEMO_TILT.desk).toBeGreaterThan(0);
    expect(MEMO_TILT.desk).toBeLessThan(0.15);
  });

  it('机の紙は壁の紙より小さい（SP の空きに収める）', () => {
    expect(MEMO_PAPER.desk.width).toBeLessThan(MEMO_PAPER.wall.width);
    expect(MEMO_TEXT.desk.lineHeight).toBeLessThan(MEMO_TEXT.wall.lineHeight);
  });

  it('文字は和文を先頭にしたゴシック（扉の紙と同じ。明朝ではない）', () => {
    expect(MEMO_FONT.startsWith('"Hiragino Sans"')).toBe(true);
    expect(MEMO_FONT).toContain('Noto Sans JP');
    expect(MEMO_FONT.endsWith('sans-serif')).toBe(true);
    expect(MEMO_FONT).not.toMatch(/Mincho|serif"/);
  });
});
