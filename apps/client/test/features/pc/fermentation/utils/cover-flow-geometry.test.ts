import { describe, expect, it } from 'vitest';
import {
  type DiscRect,
  discPlacement,
  discSize,
  ghostJarBox,
  hitTestStage,
  neighbourHalfWidth,
  neighbourPeek,
  railWindow,
} from '@/features/pc/fermentation/utils/cover-flow-geometry';

const WIDE = { width: 1440, height: 900 };
/** 詳細列（480px）を開いたときのキャンバス列。実機の主戦場。 */
const COLUMN = { width: 880, height: 830 };
const NARROW = { width: 420, height: 520 };
const TALL = { width: 2400, height: 1600 };

/** 中心 (cx,cy) に一辺 size の正方形を置いた実測矩形。 */
function rectAt(index: number, cx: number, size: number, zIndex: number): DiscRect {
  return { index, left: cx - size / 2, top: 300 - size / 2, width: size, height: size, zIndex };
}

describe('discSize', () => {
  it('縦に長い画面では上限 480 で頭打ちになる', () => {
    expect(discSize(TALL)).toBe(480);
  });

  it('ふつうの横長画面では高さ側（下の日付レールを避ける係数）で決まる', () => {
    // min(1440*0.46, 900*0.52) = min(662, 468)
    expect(discSize(WIDE)).toBeCloseTo(468);
  });

  it('詳細列を開いた列幅では、扇の余地を残すため幅側で決まる', () => {
    // min(880*0.46, 830*0.52) = min(404.8, 431.6)
    expect(discSize(COLUMN)).toBeCloseTo(404.8);
  });

  it('狭い画面では幅・高さの小さい方に追従する', () => {
    // min(420*0.46, 520*0.52) = min(193.2, 270.4) → 下限 200 に持ち上がる
    expect(discSize(NARROW)).toBe(200);
  });

  it('極端に小さい画面でも下限 200 を割らない', () => {
    expect(discSize({ width: 200, height: 200 })).toBe(200);
  });
});

describe('discPlacement', () => {
  it('正面は中央・傾きなし・不透明', () => {
    const p = discPlacement(0, WIDE);
    expect(p.translateX).toBe(0);
    expect(p.translateZ).toBe(0);
    expect(p.rotateY).toBe(0);
    expect(p.scale).toBe(1);
    expect(p.opacity).toBe(1);
    expect(p.zIndex).toBe(50);
    expect(p.size).toBe(Math.round(discSize(WIDE)));
  });

  it('隣は正面より小さく、奥へ下がり、向こう向きに倒れる', () => {
    const p = discPlacement(1, WIDE);
    expect(p.size).toBeLessThan(discSize(WIDE));
    expect(p.translateZ).toBe(-150);
    expect(p.rotateY).toBe(-46);
    expect(p.scale).toBeCloseTo(0.8);
    expect(p.zIndex).toBe(49);
  });

  it('左右は x の符号と傾きが反転する', () => {
    const left = discPlacement(-2, WIDE);
    const right = discPlacement(2, WIDE);
    expect(left.translateX).toBeCloseTo(-right.translateX);
    expect(left.rotateY).toBeCloseTo(-right.rotateY);
    // 段数が同じなら奥行き・大きさ・不透明度は同じ。
    expect(left.translateZ).toBe(right.translateZ);
    expect(left.scale).toBe(right.scale);
    expect(left.opacity).toBe(right.opacity);
  });

  it('**隣は必ず正面の縁から覗く**（履歴が何件あっても埋まらない）', () => {
    for (const canvas of [WIDE, COLUMN, NARROW]) {
      expect(neighbourPeek(canvas)).toBeGreaterThan(0);
    }
    // 実機の主戦場では、はっきり見える幅ぶん覗いていること。
    expect(neighbourPeek(COLUMN)).toBeGreaterThan(120);
  });

  it('件数に依らず 1 段目の位置は変わらない（増えるほど潰れた旧式の回帰）', () => {
    // 旧式は maxOffset に反比例して間隔が縮み、21 件で隣が中心 35px まで寄っていた。
    const one = discPlacement(1, COLUMN).translateX;
    expect(one).toBeGreaterThan(discSize(COLUMN) / 2 - 120);
    expect(one).toBeCloseTo(discPlacement(1, COLUMN).translateX);
  });

  it('2 段目から先は外側へ積み上がる（まだ続いていることを見せる）', () => {
    const xs = [1, 2, 3, 4].map((o) => discPlacement(o, COLUMN).translateX);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('積み上げは頭打ちして列の外へ出ない', () => {
    const far = discPlacement(50, COLUMN);
    // 縁の余白（48px）の内側に収まっていること。
    expect(far.translateX + neighbourHalfWidth(COLUMN)).toBeLessThanOrEqual(
      COLUMN.width / 2 - 48 + 0.5,
    );
  });

  it('遠い段でも縮小と不透明度は下限で止まる', () => {
    const far = discPlacement(20, WIDE);
    expect(far.scale).toBe(0.5);
    expect(far.opacity).toBeCloseTo(0.34);
  });

  it('狭い画面でも 1 段目は正面の外に出る', () => {
    expect(discPlacement(1, { width: 320, height: 400 }).translateX).toBeGreaterThan(0);
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

describe('railWindow', () => {
  it('件数が窓に収まるなら全部見せる（… は出さない）', () => {
    expect(railWindow(2, 5, 9)).toEqual({ start: 0, end: 5, hasBefore: false, hasAfter: false });
  });

  it('いま見ている段を中央に置く', () => {
    const w = railWindow(10, 21, 9);
    expect(w.end - w.start).toBe(9);
    // 窓の中で 10 がちょうど真ん中（前後に 4 つずつ）。
    expect(10 - w.start).toBe(4);
    expect(w.end - 1 - 10).toBe(4);
    expect(w).toMatchObject({ hasBefore: true, hasAfter: true });
  });

  it('先頭に寄ったら窓を内側へ寄せる（窓の半分を空にしない）', () => {
    const w = railWindow(0, 21, 9);
    expect(w).toEqual({ start: 0, end: 9, hasBefore: false, hasAfter: true });
  });

  it('末尾に寄ったら窓を内側へ寄せる', () => {
    const w = railWindow(20, 21, 9);
    expect(w).toEqual({ start: 12, end: 21, hasBefore: true, hasAfter: false });
  });

  it('窓は常に max 件ぶん（件数が足りるかぎり）', () => {
    for (let i = 0; i < 21; i++) {
      const w = railWindow(i, 21, 9);
      expect(w.end - w.start).toBe(9);
      expect(w.start).toBeGreaterThanOrEqual(0);
      expect(w.end).toBeLessThanOrEqual(21);
      // いま見ている段は必ず窓の中にある（飛べない段を選択中にしない）。
      expect(i).toBeGreaterThanOrEqual(w.start);
      expect(i).toBeLessThan(w.end);
    }
  });

  it('1 件でも成立する', () => {
    expect(railWindow(0, 1, 9)).toEqual({ start: 0, end: 1, hasBefore: false, hasAfter: false });
  });
});
