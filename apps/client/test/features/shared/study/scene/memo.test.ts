import { describe, expect, it } from 'vitest';
import {
  MEMO_DOT,
  MEMO_HIT,
  MEMO_PAPER,
  MEMO_TAPE,
  MEMO_TEXT,
  MEMO_TILT,
  memoHitSize,
  memoLineWidth,
  memoLineYs,
  paperOutline,
} from '@/features/shared/study/scene/memo';

const SURFACES = ['wall', 'desk'] as const;

describe('紙の輪郭（paperOutline）', () => {
  it.each(SURFACES)('%s: 上辺と左右は真っ直ぐで、破れているのは下辺だけ', (surface) => {
    const size = MEMO_PAPER[surface];
    const points = paperOutline(size);
    const halfW = size.width / 2;
    const halfH = size.height / 2;
    // 最初と最後の点が上の両角。
    expect(points[0]).toEqual({ x: -halfW, y: halfH });
    expect(points[points.length - 1]).toEqual({ x: halfW, y: halfH });
    // 左右の辺は x が端に揃う。
    expect(points[1]?.x).toBe(-halfW);
    expect(points[points.length - 2]?.x).toBe(halfW);
  });

  it.each(SURFACES)('%s: 下辺の点は下端から紙の高さの 7% 以内（本文を削らない）', (surface) => {
    const size = MEMO_PAPER[surface];
    const halfH = size.height / 2;
    const bottom = paperOutline(size).slice(1, -1);
    for (const point of bottom) {
      expect(point.y).toBeGreaterThanOrEqual(-halfH);
      expect(point.y).toBeLessThanOrEqual(-halfH + size.height * 0.07);
    }
  });

  it('下辺の点は左から右へ単調に並ぶ（輪郭が自己交差しない）', () => {
    const points = paperOutline(MEMO_PAPER.wall).slice(1, -1);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]?.x).toBeGreaterThan(points[i - 1]?.x ?? Number.NaN);
    }
  });

  it('同じ寸法なら同じ輪郭（描画のたびに破れ方が変わらない）', () => {
    expect(paperOutline(MEMO_PAPER.wall)).toEqual(paperOutline(MEMO_PAPER.wall));
  });
});

describe('行の置き方', () => {
  it('3 行を縦中央に均等に置く', () => {
    expect(memoLineYs(3, 0.5)).toEqual([0.5, 0, -0.5]);
  });

  it('1 行なら中央、0 行なら空', () => {
    expect(memoLineYs(1, 0.5)).toEqual([0]);
    expect(memoLineYs(0, 0.5)).toEqual([]);
    expect(memoLineYs(-2, 0.5)).toEqual([]);
  });

  it.each(SURFACES)('%s: 3 行が紙の中に収まる（上下に余白が残る）', (surface) => {
    const paper = MEMO_PAPER[surface];
    const text = MEMO_TEXT[surface];
    const ys = memoLineYs(3, text.gap);
    const top = (ys[0] ?? 0) + text.lineHeight / 2;
    const bottom = (ys[2] ?? 0) - text.lineHeight / 2;
    expect(top).toBeLessThan(paper.height / 2 - MEMO_TAPE.height);
    expect(bottom).toBeGreaterThan(-paper.height / 2 + paper.height * 0.07);
  });

  it('文字の面は縦横比を保つ（全行同幅にしない）', () => {
    expect(memoLineWidth({ width: 400, height: 100 }, 0.24)).toBeCloseTo(0.96, 6);
    expect(memoLineWidth({ width: 100, height: 100 }, 0.24)).toBeCloseTo(0.24, 6);
    expect(memoLineWidth({ width: 0, height: 0 }, 0.24)).toBe(0);
  });

  it.each(SURFACES)('%s: いちばん長い行（お問い合わせ 6 文字）が紙の幅に入る', (surface) => {
    const paper = MEMO_PAPER[surface];
    const text = MEMO_TEXT[surface];
    // 明朝の全角 6 文字 ＋ 左右の余白（createTextTexture が 0.4em 足す）≈ 6.4em。
    const width = memoLineWidth({ width: 6.4, height: 1.4 }, text.lineHeight);
    expect(text.inset + MEMO_DOT.gap + width).toBeLessThan(paper.width - text.inset * 0.5);
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

describe('姿勢', () => {
  it('壁の紙は少し傾き、机の紙は逆向きに少し傾く（どちらも真っ直ぐではない）', () => {
    expect(MEMO_TILT.wall).toBeLessThan(0);
    expect(MEMO_TILT.desk).toBeGreaterThan(0);
    expect(Math.abs(MEMO_TILT.wall)).toBeLessThan(0.1);
    expect(Math.abs(MEMO_TILT.desk)).toBeLessThan(0.15);
  });

  it('机の紙は壁の紙より小さい（SP の空きに収める）', () => {
    expect(MEMO_PAPER.desk.width).toBeLessThan(MEMO_PAPER.wall.width);
    expect(MEMO_TEXT.desk.lineHeight).toBeLessThan(MEMO_TEXT.wall.lineHeight);
  });
});
