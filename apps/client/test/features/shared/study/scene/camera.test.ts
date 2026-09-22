import { describe, expect, it } from 'vitest';
import { HOME_ZOOM } from '@/features/shared/study/constants';
import { PC_LAYOUT, SP_LAYOUT, type StudyLayout } from '@/features/shared/study/layout';
import {
  approach,
  boardCloseView,
  boardView,
  breathOffset,
  type CameraView,
  clampFocus,
  clampZoom,
  controlledView,
  type HomeControl,
  homeControl,
  homeView,
  jarView,
  journalSpreadView,
  journalTopView,
  lerpView,
  panByPixels,
  parallaxOffset,
  pointUnderPointer,
  rebaseZoom,
  screenFrame,
  shelfView,
  zoomByPinch,
  zoomByWheel,
  zoomForAspect,
  zoomTowardPointer,
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

/** 画面上の位置（-1..1）。`view` から見た world の点がどこに写るか。 */
function projectOnScreen(
  layout: StudyLayout,
  view: CameraView,
  point: { x: number; y: number; z: number },
): { x: number; y: number } {
  const forward = normalize({
    x: view.target.x - view.position.x,
    y: view.target.y - view.position.y,
    z: view.target.z - view.position.z,
  });
  const dot = forward.y;
  const up = normalize({ x: -forward.x * dot, y: 1 - forward.y * dot, z: -forward.z * dot });
  const right = {
    x: forward.y * up.z - forward.z * up.y,
    y: forward.z * up.x - forward.x * up.z,
    z: forward.x * up.y - forward.y * up.x,
  };
  const v = {
    x: point.x - view.position.x,
    y: point.y - view.position.y,
    z: point.z - view.position.z,
  };
  const depth = forward.x * v.x + forward.y * v.y + forward.z * v.z;
  const halfFov = Math.tan(((layout.camera.fov / 2) * Math.PI) / 180);
  return {
    x: (right.x * v.x + right.y * v.y + right.z * v.z) / depth / halfFov,
    y: (up.x * v.x + up.y * v.y + up.z * v.z) / depth / halfFov,
  };
}

function normalize(v: { x: number; y: number; z: number }) {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** 端末らしい画面。PC は横長、SP は縦長（構図がそれぞれの画面に合わせてある）。 */
function viewportOf(layout: StudyLayout): { width: number; height: number } {
  return layout.name === 'sp' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
}
function aspectOf(layout: StudyLayout): number {
  const viewport = viewportOf(layout);
  return viewport.width / viewport.height;
}

describe('ホームのカメラ操作（HomeControl）', () => {
  it.each(LAYOUTS)('$name: 等倍・ホームの注視点なら配置表どおり', (layout) => {
    expect(controlledView(layout, homeControl(layout))).toEqual(homeView(layout));
  });

  it.each(LAYOUTS)('$name: 倍率を下げると注視点に近づき、向きは変わらない', (layout) => {
    const home = homeView(layout);
    const near = controlledView(layout, { focus: home.target, zoom: 0.8 });
    expect(distance(near)).toBeCloseTo(distance(home) * 0.8, 5);
    expect(near.target).toEqual(home.target);
    // 向き（注視点 → カメラ）はホームと平行。
    const a = normalize({
      x: home.position.x - home.target.x,
      y: home.position.y - home.target.y,
      z: home.position.z - home.target.z,
    });
    const b = normalize({
      x: near.position.x - near.target.x,
      y: near.position.y - near.target.y,
      z: near.position.z - near.target.z,
    });
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
    expect(b.z).toBeCloseTo(a.z, 6);
  });

  it.each(LAYOUTS)('$name: 上下限を越えない（部屋の外も机の面だけも見せない）', (layout) => {
    const home = homeView(layout);
    const far = controlledView(layout, { focus: home.target, zoom: 99 });
    const near = controlledView(layout, { focus: home.target, zoom: 0.01 });
    expect(distance(far)).toBeCloseTo(distance(home) * clampZoom(99), 5);
    expect(distance(near)).toBeCloseTo(distance(home) * clampZoom(0.01), 5);
    expect(clampZoom(99)).toBeLessThan(99);
    expect(clampZoom(0.01)).toBeGreaterThan(0.01);
  });

  it('壊れた倍率は等倍に倒す', () => {
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(1);
  });

  describe('clampZoom — 上限は縦横比の基準に掛かる', () => {
    it('基準が 1 なら従来どおり 0.55〜1.35', () => {
      expect(clampZoom(1.65)).toBe(HOME_ZOOM.max);
      expect(clampZoom(1.65, 1)).toBe(HOME_ZOOM.max);
      expect(clampZoom(0.1, 1)).toBe(HOME_ZOOM.min);
    });

    it('基準が 1.224 なら 1.35 × 1.224 まで引ける。下限は据え置き', () => {
      const base = 1.224;
      expect(clampZoom(1.65, base)).toBeCloseTo(1.65, 6);
      expect(clampZoom(2, base)).toBeCloseTo(HOME_ZOOM.max * base, 6);
      expect(clampZoom(0.1, base)).toBe(HOME_ZOOM.min);
    });

    it.each(LAYOUTS)('$name: 基準に連れて view の距離も伸びる', (layout) => {
      const home = homeView(layout);
      const base = 1.3;
      const far = controlledView(layout, { focus: home.target, zoom: 99 }, base);
      expect(distance(far)).toBeCloseTo(distance(home) * HOME_ZOOM.max * base, 5);
    });

    it('壊れた基準や 1 未満の基準は 1 として扱う', () => {
      expect(clampZoom(1.65, Number.NaN)).toBe(HOME_ZOOM.max);
      expect(clampZoom(1.65, 0.5)).toBe(HOME_ZOOM.max);
    });
  });

  it.each(LAYOUTS)('$name: 注視点は部屋の中に留まる（clampFocus）', (layout) => {
    const bounds = layout.focusBounds;
    const far = clampFocus(layout, { x: 999, y: -999, z: 999 });
    expect(far).toEqual({ x: bounds.x[1], y: bounds.y[0], z: bounds.z[1] });
    // 壊れた値はホームの注視点へ。
    const broken = clampFocus(layout, { x: Number.NaN, y: Number.NaN, z: Number.NaN });
    expect(broken).toEqual(layout.camera.target);
    // ホームの注視点はそもそも箱の中（等倍で動かない）。
    expect(clampFocus(layout, layout.camera.target)).toEqual(layout.camera.target);
  });

  it.each(LAYOUTS)('$name: 画面の基底は互いに直交する単位ベクトル', (layout) => {
    const frame = screenFrame(layout, homeControl(layout), aspectOf(layout));
    expect(Math.hypot(frame.right.x, frame.right.y, frame.right.z)).toBeCloseTo(1, 6);
    expect(Math.hypot(frame.up.x, frame.up.y, frame.up.z)).toBeCloseTo(1, 6);
    const dot =
      frame.right.x * frame.up.x + frame.right.y * frame.up.y + frame.right.z * frame.up.z;
    expect(dot).toBeCloseTo(0, 6);
    // 右は world の +x 寄り、上は world の +y 寄り（左右上下が裏返っていない）。
    expect(frame.right.x).toBeGreaterThan(0.9);
    expect(frame.up.y).toBeGreaterThan(0.5);
    expect(frame.halfWidth).toBeCloseTo(frame.halfHeight * aspectOf(layout), 6);
  });

  describe('pointUnderPointer', () => {
    it.each(LAYOUTS)('$name: 中央は注視点そのもの', (layout) => {
      const control = homeControl(layout);
      expect(pointUnderPointer(layout, control, { x: 0, y: 0 }, aspectOf(layout))).toEqual(
        control.focus,
      );
    });

    it.each(LAYOUTS)('$name: 求めた点は実際にその画面位置に写る', (layout) => {
      const control = homeControl(layout);
      const view = controlledView(layout, control);
      for (const pointer of [
        { x: 0.6, y: 0.3 },
        { x: -0.8, y: -0.5 },
        { x: 1, y: 1 },
      ]) {
        const point = pointUnderPointer(layout, control, pointer, aspectOf(layout));
        const onScreen = projectOnScreen(layout, view, point);
        expect(onScreen.x / aspectOf(layout)).toBeCloseTo(pointer.x, 5);
        expect(onScreen.y).toBeCloseTo(pointer.y, 5);
      }
    });
  });

  describe('zoomTowardPointer — カーソルの下へ寄る', () => {
    it.each(LAYOUTS)('$name: 中央で回せばただの寄り引き（注視点は動かない）', (layout) => {
      const control = homeControl(layout);
      const next = zoomTowardPointer(layout, control, 0.8, { x: 0, y: 0 }, aspectOf(layout));
      expect(next.zoom).toBeCloseTo(0.8, 6);
      expect(next.focus.x).toBeCloseTo(control.focus.x, 6);
      expect(next.focus.y).toBeCloseTo(control.focus.y, 6);
      expect(next.focus.z).toBeCloseTo(control.focus.z, 6);
    });

    it.each(LAYOUTS)('$name: カーソルの下の点が画面上で動かない', (layout) => {
      const control = homeControl(layout);
      const pointer = { x: 0.5, y: 0.4 };
      const anchor = pointUnderPointer(layout, control, pointer, aspectOf(layout));
      const before = projectOnScreen(layout, controlledView(layout, control), anchor);
      const next = zoomTowardPointer(layout, control, 0.75, pointer, aspectOf(layout));
      const after = projectOnScreen(layout, controlledView(layout, next), anchor);
      expect(after.x).toBeCloseTo(before.x, 4);
      expect(after.y).toBeCloseTo(before.y, 4);
    });

    it.each(LAYOUTS)('$name: 寄るとカーソルの側へ注視点が動き、引くと戻る', (layout) => {
      const control = homeControl(layout);
      const aspect = aspectOf(layout);
      const near = zoomTowardPointer(layout, control, 0.7, { x: 0.9, y: 0 }, aspect);
      expect(near.focus.x).toBeGreaterThan(control.focus.x);
      const back = zoomTowardPointer(layout, near, 1, { x: 0.9, y: 0 }, aspect);
      expect(back.focus.x).toBeCloseTo(control.focus.x, 4);
    });

    it.each(LAYOUTS)('$name: 倍率が変わらなければ注視点も動かない', (layout) => {
      const control: HomeControl = { focus: { ...layout.camera.target, x: 1 }, zoom: 0.9 };
      const same = zoomTowardPointer(layout, control, 0.9, { x: 1, y: 1 }, aspectOf(layout));
      expect(same.focus).toEqual(control.focus);
      expect(same.zoom).toBe(0.9);
    });

    it.each(LAYOUTS)('$name: 端で寄り続けても部屋の外へ出ない', (layout) => {
      let control = homeControl(layout);
      for (let i = 0; i < 40; i++) {
        control = zoomTowardPointer(
          layout,
          control,
          control.zoom * 0.9,
          { x: 1, y: 1 },
          aspectOf(layout),
        );
      }
      const bounds = layout.focusBounds;
      expect(control.focus.x).toBeLessThanOrEqual(bounds.x[1]);
      expect(control.focus.y).toBeLessThanOrEqual(bounds.y[1]);
      expect(control.zoom).toBe(HOME_ZOOM.min);
    });
  });

  describe('panByPixels — つかんで動かす', () => {
    it.each(LAYOUTS)('$name: 右へ引くと絵が右へ付いてくる（注視点は左へ）', (layout) => {
      const control = homeControl(layout);
      const next = panByPixels(layout, control, { x: 120, y: 0 }, viewportOf(layout));
      expect(next.focus.x).toBeLessThan(control.focus.x);
      expect(next.zoom).toBe(control.zoom);
    });

    it.each(LAYOUTS)('$name: 下へ引くと絵が下へ付いてくる（注視点は上へ）', (layout) => {
      const control = homeControl(layout);
      const next = panByPixels(layout, control, { x: 0, y: 80 }, viewportOf(layout));
      expect(next.focus.y).toBeGreaterThan(control.focus.y);
    });

    it.each(LAYOUTS)('$name: 引いた px のぶんだけ画面上で動く（1px = 1px）', (layout) => {
      const control = homeControl(layout);
      const viewport = viewportOf(layout);
      const delta = { x: 90, y: -60 };
      const next = panByPixels(layout, control, delta, viewport);
      // 元の注視点は、動かしたあとの view では delta ぶんずれて写る。
      const onScreen = projectOnScreen(layout, controlledView(layout, next), control.focus);
      const halfH = viewport.height / 2;
      expect(onScreen.x * halfH).toBeCloseTo(delta.x, 3);
      expect(onScreen.y * halfH).toBeCloseTo(-delta.y, 3);
    });

    it.each(LAYOUTS)('$name: 引き続けても部屋の外へ出ない', (layout) => {
      let control = homeControl(layout);
      for (let i = 0; i < 100; i++) {
        control = panByPixels(layout, control, { x: -400, y: 400 }, viewportOf(layout));
      }
      const bounds = layout.focusBounds;
      expect(control.focus.x).toBeLessThanOrEqual(bounds.x[1]);
      expect(control.focus.y).toBeGreaterThanOrEqual(bounds.y[0]);
    });

    it('壊れた delta や 0 の画面では動かさない', () => {
      const control = homeControl(PC_LAYOUT);
      const viewport = viewportOf(PC_LAYOUT);
      expect(panByPixels(PC_LAYOUT, control, { x: Number.NaN, y: 0 }, viewport)).toBe(control);
      expect(panByPixels(PC_LAYOUT, control, { x: 10, y: 0 }, { width: 0, height: 0 })).toBe(
        control,
      );
    });
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

    it('基準が上がっていれば、そのぶん先まで引ける', () => {
      const base = 1.224;
      let zoom = base;
      for (let i = 0; i < 500; i += 1) zoom = zoomByWheel(zoom, 100, base);
      expect(zoom).toBeCloseTo(HOME_ZOOM.max * base, 6);
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

    it('基準が上がっていれば、そのぶん先まで引ける', () => {
      const base = 1.224;
      expect(zoomByPinch(base, 0.5, base)).toBeCloseTo(HOME_ZOOM.max * base, 6);
      expect(zoomByPinch(base, 0.5)).toBe(HOME_ZOOM.max);
      expect(zoomByPinch(1, 0.5)).toBe(HOME_ZOOM.max);
    });

    it('比が 0 や負でも落ちない', () => {
      expect(zoomByPinch(1, 0)).toBe(1);
      expect(zoomByPinch(1, -2)).toBe(1);
      expect(zoomByPinch(1, Number.NaN)).toBe(1);
    });
  });
});

/**
 * 等倍で絵の上端（ボードの上辺 = `frameTop`）が画面に**余白つきで**入っていること。
 * 上端ぴったりに置いていたころ、少し寄るだけで「ボードの上側が切れる」と報告された。
 */
describe('ホームの構図', () => {
  it.each(LAYOUTS)('$name: 絵の上端が画面の上端から 5% 以上内側にある', (layout) => {
    const onScreen = projectOnScreen(layout, homeView(layout), layout.camera.frameTop);
    expect(onScreen.y).toBeLessThan(0.95);
    expect(onScreen.y).toBeGreaterThan(0);
  });
});

describe('zoomForAspect — 画面が構図より横に狭ければ引く', () => {
  it('構図の縦横比以上なら等倍', () => {
    expect(zoomForAspect(PC_LAYOUT, PC_LAYOUT.homeAspect)).toBe(1);
    expect(zoomForAspect(PC_LAYOUT, 2.0)).toBe(1);
  });

  it('ヘルプの面が右に立った 1104 × 900 では、机が丸ごと入るぶん引く', () => {
    const zoom = zoomForAspect(PC_LAYOUT, 1104 / 900);
    expect(zoom).toBeGreaterThan(1.15);
    expect(zoom).toBeLessThan(1.3);
  });

  it('狭いほど引く。寄り引きの上限（1.35）で頭打ちにしない — そこで止めると机が切れたまま', () => {
    expect(zoomForAspect(PC_LAYOUT, 1.0)).toBeGreaterThan(zoomForAspect(PC_LAYOUT, 1.3));
    expect(zoomForAspect(PC_LAYOUT, 0.8)).toBeGreaterThan(HOME_ZOOM.max);
    expect(zoomForAspect(PC_LAYOUT, 0.3)).toBeGreaterThan(zoomForAspect(PC_LAYOUT, 0.8));
  });

  it('SP は縦持ちの構図なので、その比では等倍', () => {
    expect(zoomForAspect(SP_LAYOUT, 390 / 844)).toBe(1);
  });

  it('壊れた比は等倍', () => {
    expect(zoomForAspect(PC_LAYOUT, Number.NaN)).toBe(1);
    expect(zoomForAspect(PC_LAYOUT, 0)).toBe(1);
  });
});

/**
 * 窓の大きさが変わったとき、利用者が寄せた比を新しい基準に掛け直す（`scene.ts` の
 * ResizeObserver がやること）。比は `scene.ts` が持ち続け、丸めた値から逆算しない。
 */
describe('rebaseZoom — 面の開閉で寄せた比を失わない', () => {
  const panelOpen = zoomForAspect(PC_LAYOUT, 1104 / 900);
  const panelClosed = zoomForAspect(PC_LAYOUT, 1440 / 900);

  it('1440 × 900 で引き切った 1.35 は、面を開けて閉じても 1.35 のまま', () => {
    expect(panelClosed).toBe(1);
    const userZoom = HOME_ZOOM.max;
    const opened = rebaseZoom(userZoom, panelOpen);
    // 開いている間は基準のぶん先まで引いている（1.35 で頭打ちにしない）。
    expect(opened).toBeCloseTo(HOME_ZOOM.max * panelOpen, 6);
    expect(opened).toBeGreaterThan(HOME_ZOOM.max);
    const closed = rebaseZoom(userZoom, panelClosed);
    expect(closed).toBe(HOME_ZOOM.max);
  });

  it('等倍で始めた人は、開けると基準ぶん引き、閉じると等倍に戻る', () => {
    expect(rebaseZoom(1, panelOpen)).toBeCloseTo(panelOpen, 6);
    expect(rebaseZoom(1, panelClosed)).toBe(1);
  });

  it('寄り切った 0.55 は下限で止まり、閉じれば 0.55 に戻る', () => {
    // 面を開けたまま 0.55 まで寄せた人の比は 0.55 / 1.22。閉じると下限に掛かる。
    const userZoom = HOME_ZOOM.min / panelOpen;
    expect(rebaseZoom(userZoom, panelOpen)).toBeCloseTo(HOME_ZOOM.min, 6);
    expect(rebaseZoom(userZoom, panelClosed)).toBe(HOME_ZOOM.min);
  });
});
