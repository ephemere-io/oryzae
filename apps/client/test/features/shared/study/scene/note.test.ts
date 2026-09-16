import { describe, expect, it } from 'vitest';
import {
  NOTE_HIT_DEPTH,
  NOTE_PAPER,
  NOTE_PEEL,
  NOTE_TEXT,
  NOTE_TILT,
  noteHitSize,
  noteLineWidth,
  noteLineYs,
  noteOutline,
  peelPose,
} from '@/features/shared/study/scene/note';

describe('紙の輪郭（noteOutline）', () => {
  it('四隅だけの真っ直ぐな矩形（破れも角の丸みも無い）', () => {
    const halfW = NOTE_PAPER.width / 2;
    const halfH = NOTE_PAPER.height / 2;
    expect(noteOutline()).toEqual([
      { x: -halfW, y: halfH },
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
    ]);
  });

  it('縮めると相似に縮む', () => {
    const small = noteOutline(0.5);
    expect(small[0]).toEqual({ x: -NOTE_PAPER.width / 4, y: NOTE_PAPER.height / 4 });
  });

  it('横長のメモ用紙（3 行が余白ごと入る）', () => {
    expect(NOTE_PAPER.width).toBeGreaterThan(NOTE_PAPER.height);
  });
});

describe('行の置き方', () => {
  it('3 行を縦中央に均等に置く', () => {
    const ys = noteLineYs(3, NOTE_TEXT.gap);
    expect(ys[0]).toBeCloseTo(NOTE_TEXT.gap, 10);
    expect(ys[1]).toBeCloseTo(0, 10);
    expect(ys[2]).toBeCloseTo(-NOTE_TEXT.gap, 10);
  });

  it('1 行なら中央、0 行なら空', () => {
    expect(noteLineYs(1, 0.5)).toEqual([0]);
    expect(noteLineYs(0, 0.5)).toEqual([]);
    expect(noteLineYs(-2, 0.5)).toEqual([]);
  });

  it('3 行が紙の中に収まる（上下に余白が残る）', () => {
    const ys = noteLineYs(3, NOTE_TEXT.gap);
    const top = (ys[0] ?? 0) + NOTE_TEXT.lineHeight / 2;
    const bottom = (ys[2] ?? 0) - NOTE_TEXT.lineHeight / 2;
    expect(top).toBeLessThan(NOTE_PAPER.height / 2 - 0.1);
    expect(bottom).toBeGreaterThan(-NOTE_PAPER.height / 2 + 0.1);
  });

  it('文字の面は縦横比を保つ（全行同幅にしない）', () => {
    expect(noteLineWidth({ width: 400, height: 100 }, 0.28)).toBeCloseTo(1.12, 6);
    expect(noteLineWidth({ width: 100, height: 100 }, 0.28)).toBeCloseTo(0.28, 6);
    expect(noteLineWidth({ width: 0, height: 0 }, 0.28)).toBe(0);
  });

  it('いちばん長い行（11 文字）が紙の幅に入る', () => {
    // 全角 11 文字 ＋ 左右の余白（createTextTexture が 0.4em 足す）≈ 11.4em、高さ 1.4em。
    const width = noteLineWidth({ width: 11.4, height: 1.4 }, NOTE_TEXT.lineHeight);
    expect(NOTE_TEXT.inset + width).toBeLessThan(NOTE_PAPER.width - NOTE_TEXT.inset * 0.5);
  });
});

describe('当たりの箱', () => {
  it('紙そのものの大きさで、指が届く厚みを持つ', () => {
    expect(noteHitSize()).toEqual([NOTE_PAPER.width, NOTE_PAPER.height, NOTE_HIT_DEPTH]);
    const [w, h] = noteHitSize(0.78);
    expect(w).toBeCloseTo(NOTE_PAPER.width * 0.78, 10);
    expect(h).toBeCloseTo(NOTE_PAPER.height * 0.78, 10);
  });
});

describe('はがす動き（peelPose）', () => {
  it('始まりは置いたまま、終わりは持ち上がって消える', () => {
    expect(peelPose(0)).toEqual({ rise: 0, opacity: 1 });
    expect(peelPose(1)).toEqual({ rise: NOTE_PEEL.rise, opacity: 0 });
  });

  it('途中は単調に上がり、薄くなる', () => {
    const a = peelPose(0.3);
    const b = peelPose(0.7);
    expect(b.rise).toBeGreaterThan(a.rise);
    expect(b.opacity).toBeLessThan(a.opacity);
  });

  it('範囲外・壊れた値は終わりに倒す', () => {
    expect(peelPose(2)).toEqual(peelPose(1));
    expect(peelPose(-1)).toEqual(peelPose(0));
    expect(peelPose(Number.NaN)).toEqual(peelPose(1));
  });

  it('動きは半秒以内（待たせない）', () => {
    expect(NOTE_PEEL.durationMs).toBeLessThanOrEqual(500);
  });
});

describe('姿勢', () => {
  it('置いた紙は真っ直ぐには止まらないが、傾きはわずか', () => {
    expect(NOTE_TILT).toBeGreaterThan(0);
    expect(NOTE_TILT).toBeLessThan(0.1);
  });
});
