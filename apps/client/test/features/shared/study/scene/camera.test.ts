import { describe, expect, it } from 'vitest';
import { PC_LAYOUT, SP_LAYOUT, type StudyLayout } from '@/features/shared/study/layout';
import {
  approach,
  boardCloseView,
  boardView,
  breathOffset,
  type CameraView,
  homeView,
  jarView,
  journalSpreadView,
  journalTopView,
  lerpView,
  parallaxOffset,
  shelfView,
} from '@/features/shared/study/scene/camera';

const LAYOUTS: StudyLayout[] = [PC_LAYOUT, SP_LAYOUT];

function distance(view: CameraView): number {
  const dx = view.position.x - view.target.x;
  const dy = view.position.y - view.target.y;
  const dz = view.position.z - view.target.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

describe('すべての行き先に共通して成り立つこと', () => {
  const views = (layout: StudyLayout): [string, CameraView][] => [
    ['home', homeView(layout)],
    ['jar', jarView(layout)],
    ['journalTop', journalTopView(layout, 0.5)],
    ['journalSpread', journalSpreadView(layout, 0.5)],
    ['board', boardView(layout)],
    ['boardClose', boardCloseView(layout)],
    ['shelf', shelfView(layout)],
  ];

  it.each(LAYOUTS)('$name: カメラが注視点と重ならない（lookAt が破綻する）', (layout) => {
    for (const [name, view] of views(layout)) {
      expect(distance(view), name).toBeGreaterThan(0.5);
    }
  });

  it.each(LAYOUTS)('$name: 座標がすべて有限', (layout) => {
    for (const [name, view] of views(layout)) {
      for (const value of Object.values(view.position)) {
        expect(Number.isFinite(value), `${name}.position`).toBe(true);
      }
      for (const value of Object.values(view.target)) {
        expect(Number.isFinite(value), `${name}.target`).toBe(true);
      }
    }
  });

  it.each(LAYOUTS)('$name: ホームは配置表の値をそのまま返す', (layout) => {
    expect(homeView(layout)).toEqual({
      position: layout.camera.position,
      target: layout.camera.target,
    });
  });

  it.each(LAYOUTS)('$name: ホームの view を書き換えても配置表が汚れない', (layout) => {
    const view = homeView(layout);
    view.position.x = 999;
    expect(layout.camera.position.x).not.toBe(999);
  });
});

describe('jarView', () => {
  it.each(LAYOUTS)(
    '$name: 瓶の真上ではなく手前から見る（パンであってズームではない）',
    (layout) => {
      const view = jarView(layout);
      // 注視点の x が瓶に一致し、z 方向に離れている＝横へパンして正対する形。
      expect(view.target.x).toBe(layout.jar.x);
      expect(view.position.z).toBeGreaterThan(view.target.z);
    },
  );

  it.each(LAYOUTS)('$name: 瓶の中ほどを見る（底や口ではない）', (layout) => {
    const view = jarView(layout);
    expect(view.target.y).toBeGreaterThan(layout.jar.y);
    expect(view.target.y).toBeLessThan(layout.jar.y + 2.94);
  });

  it('PC では瓶が中央に来るよう左へ寄る', () => {
    // 瓶は x = -4.2。ホームの注視点 0 から瓶へ寄る＝左方向へのパン。
    expect(jarView(PC_LAYOUT).target.x).toBeLessThan(homeView(PC_LAYOUT).target.x);
  });
});

describe('journalTopView / journalSpreadView', () => {
  it.each(LAYOUTS)('$name: 真上から見る（カメラが注視点の真上）', (layout) => {
    const view = journalTopView(layout, 0.5);
    expect(view.position.x).toBe(view.target.x);
    expect(view.position.y).toBeGreaterThan(view.target.y);
  });

  it.each(LAYOUTS)(
    '$name: 完全な真上を避けて z をずらす（up と平行で lookAt が壊れる）',
    (layout) => {
      const view = journalTopView(layout, 0.5);
      expect(view.position.z).not.toBe(view.target.z);
    },
  );

  it.each(LAYOUTS)('$name: 積みが高いほどカメラも上がる', (layout) => {
    expect(journalTopView(layout, 2).position.y).toBeGreaterThan(
      journalTopView(layout, 0.5).position.y,
    );
  });

  it.each(LAYOUTS)('$name: 見開きは蝶番のぶん左へずれる', (layout) => {
    expect(journalSpreadView(layout, 0.5).target.x).toBeLessThan(
      journalTopView(layout, 0.5).target.x,
    );
  });

  it.each(LAYOUTS)('$name: 見開きは真上より近い（開いた面に寄る）', (layout) => {
    expect(distance(journalSpreadView(layout, 0.5))).toBeLessThan(
      distance(journalTopView(layout, 0.5)),
    );
  });
});

describe('boardView / boardCloseView', () => {
  it.each(LAYOUTS)('$name: 板に正対する（x と y が一致）', (layout) => {
    const view = boardView(layout);
    expect(view.position.x).toBe(view.target.x);
    expect(view.position.y).toBe(view.target.y);
    expect(view.position.z).toBeGreaterThan(view.target.z);
  });

  it.each(LAYOUTS)('$name: 寄った view は正対より近い', (layout) => {
    expect(distance(boardCloseView(layout))).toBeLessThan(distance(boardView(layout)));
  });

  it.each(LAYOUTS)('$name: 寄っても板を突き抜けない', (layout) => {
    expect(boardCloseView(layout).position.z).toBeGreaterThan(layout.board.position.z);
  });

  it('SP は正対の時点で PC より遠い（クオータートップから引く）', () => {
    expect(distance(boardView(SP_LAYOUT))).toBeGreaterThan(distance(boardView(PC_LAYOUT)));
  });
});

describe('shelfView', () => {
  it.each(LAYOUTS)('$name: 棚を斜め上・手前から見る', (layout) => {
    const view = shelfView(layout);
    expect(view.position.y).toBeGreaterThan(view.target.y);
    expect(view.position.z).toBeGreaterThan(view.target.z);
  });
});

describe('breathOffset', () => {
  it('0 から始まり、振幅に収まる', () => {
    expect(breathOffset(0)).toBeCloseTo(0, 10);
    for (let ms = 0; ms < 3000; ms += 37) {
      expect(Math.abs(breathOffset(ms))).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });

  it('1 秒周期で戻る', () => {
    expect(breathOffset(1000)).toBeCloseTo(breathOffset(0), 10);
    expect(breathOffset(1500)).toBeCloseTo(breathOffset(500), 10);
  });
});

describe('parallaxOffset', () => {
  it('PC はポインタに応じて振れる', () => {
    expect(parallaxOffset(PC_LAYOUT, { x: 1, y: 1 })).toEqual({ x: 0.55, y: 0.3 });
    expect(parallaxOffset(PC_LAYOUT, { x: -1, y: -1 })).toEqual({ x: -0.55, y: -0.3 });
    expect(parallaxOffset(PC_LAYOUT, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('SP は振れない', () => {
    expect(parallaxOffset(SP_LAYOUT, { x: 1, y: 1 })).toEqual({ x: 0, y: 0 });
  });

  it('範囲外のポインタでも振幅を超えない', () => {
    expect(parallaxOffset(PC_LAYOUT, { x: 99, y: -99 })).toEqual({ x: 0.55, y: -0.3 });
  });

  it('壊れたポインタで NaN を出さない', () => {
    expect(parallaxOffset(PC_LAYOUT, { x: Number.NaN, y: Number.NaN })).toEqual({ x: 0, y: 0 });
  });
});

describe('approach / lerpView', () => {
  it('approach は目標へ寄る', () => {
    expect(approach(0, 10, 0.5)).toBe(5);
    expect(approach(0, 10, 0)).toBe(0);
    expect(approach(0, 10, 1)).toBe(10);
  });

  it('lerpView は両端でそれぞれの view に一致する', () => {
    const from = homeView(PC_LAYOUT);
    const to = boardView(PC_LAYOUT);
    expect(lerpView(from, to, 0)).toEqual(from);
    expect(lerpView(from, to, 1)).toEqual(to);
  });

  it('lerpView の中点が両端の中間になる', () => {
    const from = homeView(PC_LAYOUT);
    const to = boardView(PC_LAYOUT);
    const mid = lerpView(from, to, 0.5);
    expect(mid.position.z).toBeCloseTo((from.position.z + to.position.z) / 2, 10);
  });
});
