import { describe, expect, it } from 'vitest';
import {
  type DiscRect,
  discPlacement,
  discSize,
  ghostJarBox,
  hitTestStage,
  maxOffsetFrom,
} from '@/features/pc/fermentation/utils/cover-flow-geometry';

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 420, height: 520 };
const TALL = { width: 2400, height: 1600 };

/** 中心 (cx,cy) に一辺 size の正方形を置いた実測矩形。 */
function rectAt(index: number, cx: number, size: number, zIndex: number): DiscRect {
  return { index, left: cx - size / 2, top: 300 - size / 2, width: size, height: size, zIndex };
}

describe('discSize', () => {
  it('縦に長い画面では上限 560 で頭打ちになる', () => {
    expect(discSize(TALL)).toBe(560);
  });

  it('ふつうの横長画面では高さ側（下のクロームを避ける係数）で決まる', () => {
    // min(1440*0.55, 900*0.52) = min(792, 468)
    expect(discSize(WIDE)).toBeCloseTo(468);
  });

  it('狭い画面では幅・高さの小さい方に追従する', () => {
    // min(420*0.55, 520*0.52) = min(231, 270.4)
    expect(discSize(NARROW)).toBeCloseTo(231);
  });

  it('極端に小さい画面でも下限 200 を割らない', () => {
    expect(discSize({ width: 200, height: 200 })).toBe(200);
  });
});

describe('discPlacement', () => {
  it('正面は中央・傾きなし・不透明', () => {
    const p = discPlacement(0, 3, WIDE);
    expect(p.translateX).toBe(0);
    expect(p.translateZ).toBe(0);
    expect(p.rotateY).toBe(0);
    expect(p.scale).toBe(1);
    expect(p.opacity).toBe(1);
    expect(p.zIndex).toBe(50);
    expect(p.size).toBe(Math.round(discSize(WIDE)));
  });

  it('隣は正面より小さく、奥へ下がり、向こう向きに倒れる', () => {
    const p = discPlacement(1, 3, WIDE);
    expect(p.size).toBeLessThan(discSize(WIDE));
    expect(p.translateZ).toBe(-150);
    expect(p.rotateY).toBe(-46);
    expect(p.scale).toBeCloseTo(0.8);
    expect(p.zIndex).toBe(49);
  });

  it('左右は x の符号と傾きが反転する', () => {
    const left = discPlacement(-2, 3, WIDE);
    const right = discPlacement(2, 3, WIDE);
    expect(left.translateX).toBeCloseTo(-right.translateX);
    expect(left.rotateY).toBeCloseTo(-right.rotateY);
    // 段数が同じなら奥行き・大きさ・不透明度は同じ。
    expect(left.translateZ).toBe(right.translateZ);
    expect(left.scale).toBe(right.scale);
    expect(left.opacity).toBe(right.opacity);
  });

  it('段ごとに x が必ず違う（遠い段が団子にならない）', () => {
    const xs = [1, 2, 3, 4, 5].map((o) => discPlacement(o, 5, WIDE).translateX);
    const unique = new Set(xs.map((x) => Math.round(x * 1000)));
    expect(unique.size).toBe(xs.length);
    // 単調に外側へ伸びる。
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('段が増えるほど 1 段あたりの間隔は詰まる（扇が画面から溢れない）', () => {
    const few = discPlacement(1, 1, WIDE).translateX;
    const many = discPlacement(1, 8, WIDE).translateX;
    expect(many).toBeLessThan(few);
  });

  it('遠い段でも縮小と不透明度は下限で止まる', () => {
    const far = discPlacement(20, 20, WIDE);
    expect(far.scale).toBe(0.5);
    expect(far.opacity).toBeCloseTo(0.34);
  });

  it('狭い画面でも扇の間隔は 0 にならない', () => {
    expect(discPlacement(1, 6, { width: 320, height: 400 }).translateX).toBeGreaterThan(0);
  });
});

describe('maxOffsetFrom', () => {
  it('端にいるときは反対の端までの距離', () => {
    expect(maxOffsetFrom(0, 5)).toBe(4);
    expect(maxOffsetFrom(4, 5)).toBe(4);
  });

  it('真ん中にいるときは遠い側までの距離', () => {
    expect(maxOffsetFrom(2, 5)).toBe(2);
    expect(maxOffsetFrom(1, 5)).toBe(3);
  });

  it('1 件しかなければ 0', () => {
    expect(maxOffsetFrom(0, 1)).toBe(0);
  });
});

describe('hitTestStage', () => {
  // 正面 (index=1) が中央 600、左 (0) が 200、右 (2) が 1000。
  const discs: DiscRect[] = [
    rectAt(0, 200, 200, 49),
    rectAt(1, 600, 400, 50),
    rectAt(2, 1000, 200, 49),
  ];

  it('隣の円盤を押したらその段へ', () => {
    expect(hitTestStage({ x: 200, y: 300 }, discs, 1)).toEqual({ kind: 'goTo', index: 0 });
    expect(hitTestStage({ x: 1000, y: 300 }, discs, 1)).toEqual({ kind: 'goTo', index: 2 });
  });

  it('正面の円の中は何もしない（誤って閉じない）', () => {
    expect(hitTestStage({ x: 600, y: 300 }, discs, 1)).toEqual({ kind: 'ignore' });
    // 円の縁ぎりぎりの内側。
    expect(hitTestStage({ x: 795, y: 300 }, discs, 1)).toEqual({ kind: 'ignore' });
  });

  it('正面の矩形の中でも円の外＝外周の影の帯なら、その側の隣へ送る', () => {
    // 正面の矩形は 400..800。角の (790, 110) は矩形内だが中心から半径 200 の外。
    const hit = hitTestStage({ x: 790, y: 110 }, discs, 1);
    expect(hit).toEqual({ kind: 'goTo', index: 2 });
  });

  it('円盤から離れた背景を押したら閉じる', () => {
    expect(hitTestStage({ x: 1400, y: 800 }, discs, 1)).toEqual({ kind: 'close' });
  });

  it('重なっているときは手前（z-index が大きい方）を採る', () => {
    const stacked: DiscRect[] = [
      rectAt(0, 300, 200, 48),
      rectAt(1, 320, 200, 49), // 手前
      rectAt(2, 600, 400, 50), // 正面
    ];
    expect(hitTestStage({ x: 310, y: 300 }, stacked, 2)).toEqual({ kind: 'goTo', index: 1 });
  });

  it('円盤が 1 枚だけなら、外周の帯を押しても送る先が無いので何もしない', () => {
    const single: DiscRect[] = [rectAt(0, 600, 400, 50)];
    expect(hitTestStage({ x: 790, y: 110 }, single, 0)).toEqual({ kind: 'ignore' });
    // 離れた背景はちゃんと閉じる。
    expect(hitTestStage({ x: 1400, y: 800 }, single, 0)).toEqual({ kind: 'close' });
  });
});

describe('ghostJarBox', () => {
  it('円盤に追従しつつ 4:5 の比率を保つ', () => {
    const box = ghostJarBox(WIDE);
    expect(box.width).toBe(Math.round(box.height * 0.8));
  });

  it('キャンバスより高くならない（上下がはみ出さない）', () => {
    const canvas = { width: 1440, height: 500 };
    expect(ghostJarBox(canvas).height).toBeLessThanOrEqual(canvas.height - 120);
  });
});
