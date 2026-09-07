import { describe, expect, it } from 'vitest';
import { PC_LAYOUT, SP_LAYOUT, type StudyLayout } from '@/features/shared/study/layout';
import {
  approach,
  boardCloseView,
  boardView,
  breathOffset,
  type CameraView,
  clampZoom,
  homeView,
  jarView,
  journalSpreadView,
  journalTopView,
  lerpView,
  parallaxOffset,
  shelfView,
  zoomByPinch,
  zoomByWheel,
  zoomedView,
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

  it('約 6.3 秒（2π 秒）で一周する', () => {
    // 1 秒周期にすると画面全体が小刻みに上下して酔う（実機で報告された）。
    const periodMs = Math.PI * 2 * 1000;
    expect(breathOffset(periodMs)).toBeCloseTo(breathOffset(0), 10);
    expect(breathOffset(periodMs / 2)).toBeCloseTo(-breathOffset(0), 10);
    // 1 秒後にはまだ一周していない（＝速すぎない）。
    expect(breathOffset(1000)).not.toBeCloseTo(breathOffset(0), 3);
  });

  it('1 秒あたりの動きが小さい（せわしなく見えない）', () => {
    let maxStep = 0;
    for (let ms = 0; ms < 8000; ms += 16) {
      maxStep = Math.max(maxStep, Math.abs(breathOffset(ms + 16) - breathOffset(ms)));
    }
    // 1 フレームあたりの変化が振幅の 2% を超えると、揺れとして目に付く。
    expect(maxStep).toBeLessThan(0.05 * 0.02);
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

describe('寄り引き（ホームのカメラ）', () => {
  const VIEW: CameraView = {
    position: { x: 0, y: 4, z: 12 },
    target: { x: 0, y: 0, z: 0 },
  };

  it('等倍なら配置表どおり', () => {
    expect(zoomedView(VIEW, 1)).toEqual(VIEW);
  });

  it('倍率を下げると注視点に近づく', () => {
    const near = zoomedView(VIEW, 0.8);
    expect(near.position.z).toBeCloseTo(9.6, 5);
    expect(near.position.y).toBeCloseTo(3.2, 5);
  });

  it('注視点は動かさない（寄り引きが平行移動を兼ねない）', () => {
    // 動かせるようにすると、寄り引きだけで部屋の外へ出られてしまう。
    for (const zoom of [0.5, 1, 2]) {
      expect(zoomedView(VIEW, zoom).target).toEqual(VIEW.target);
    }
  });

  it('上下限を越えない（部屋の外も机の面だけも見せない）', () => {
    const far = zoomedView(VIEW, 99);
    const near = zoomedView(VIEW, 0.01);
    expect(far.position.z).toBeCloseTo(12 * clampZoom(99), 5);
    expect(near.position.z).toBeCloseTo(12 * clampZoom(0.01), 5);
    expect(clampZoom(99)).toBeLessThan(99);
    expect(clampZoom(0.01)).toBeGreaterThan(0.01);
  });

  it('壊れた倍率は等倍に倒す', () => {
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });

  describe('zoomByWheel', () => {
    it('下へ回すと離れる（ブラウザのページ送りと同じ向き）', () => {
      expect(zoomByWheel(1, 100)).toBeGreaterThan(1);
      expect(zoomByWheel(1, -100)).toBeLessThan(1);
    });

    it('回し続けても上下限を越えない', () => {
      let zoom = 1;
      for (let i = 0; i < 500; i += 1) zoom = zoomByWheel(zoom, 100);
      expect(zoom).toBe(clampZoom(zoom));
      expect(zoom).toBeLessThanOrEqual(clampZoom(Number.MAX_SAFE_INTEGER));
    });

    it('壊れた delta では動かさない', () => {
      expect(zoomByWheel(1.1, Number.NaN)).toBeCloseTo(1.1, 5);
    });
  });

  describe('zoomByPinch', () => {
    it('指を広げると近づく（距離は比の逆数）', () => {
      expect(zoomByPinch(1, 1.25)).toBeCloseTo(0.8, 5);
      expect(zoomByPinch(1, 0.8)).toBeCloseTo(1.25, 5);
    });

    it('置いた時点の倍率から積み上げる（毎回 1 に戻さない）', () => {
      expect(zoomByPinch(0.9, 1)).toBeCloseTo(0.9, 5);
    });

    it('比が 0 や負でも落ちない', () => {
      expect(zoomByPinch(1, 0)).toBe(1);
      expect(zoomByPinch(1, -2)).toBe(1);
      expect(zoomByPinch(1, Number.NaN)).toBe(1);
    });
  });
});
