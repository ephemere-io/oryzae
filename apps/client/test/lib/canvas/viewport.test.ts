import { describe, expect, it } from 'vitest';
import {
  clampScale,
  fitBounds,
  MAX_SCALE,
  MIN_SCALE,
  normalizeViewport,
  panBy,
  screenToWorld,
  toTransform,
  unionBounds,
  type Viewport,
  viewportCenterWorld,
  worldToScreen,
  zoomAt,
  zoomTo,
} from '@/lib/canvas/viewport';

// ズーム実装が壊れるのはほぼ変換式なので、UI ではなくここを厚く固める。
// とくに「カーソル下の点が動かない」ことは目で見て気づきにくく、
// 一度ずれると操作のたびに絵が流れていく（Figma 的でない）致命的な壊れ方になる。

const VIEWPORTS: Viewport[] = [
  { x: 0, y: 0, scale: 1 },
  { x: 120, y: -80, scale: 1 },
  { x: -340, y: 210, scale: 0.5 },
  { x: 55.5, y: 12.25, scale: 2.4 },
];

describe('screenToWorld / worldToScreen', () => {
  it('往復すると元の座標に戻る', () => {
    for (const vp of VIEWPORTS) {
      for (const [sx, sy] of [
        [0, 0],
        [400, 300],
        [-120, 950],
      ]) {
        const world = screenToWorld(vp, sx, sy);
        const back = worldToScreen(vp, world.x, world.y);
        expect(back.x).toBeCloseTo(sx, 9);
        expect(back.y).toBeCloseTo(sy, 9);
      }
    }
  });

  it('等倍・無移動なら screen と world は一致する', () => {
    const vp: Viewport = { x: 0, y: 0, scale: 1 };
    expect(screenToWorld(vp, 42, 99)).toEqual({ x: 42, y: 99 });
    expect(worldToScreen(vp, 42, 99)).toEqual({ x: 42, y: 99 });
  });

  it('transform 文字列は translate → scale の順で出る（変換式の前提）', () => {
    expect(toTransform({ x: 10, y: -20, scale: 1.5 })).toBe('translate(10px, -20px) scale(1.5)');
  });
});

describe('zoomAt', () => {
  it('アンカー直下の world 点はズーム前後で動かない', () => {
    for (const vp of VIEWPORTS) {
      for (const factor of [1.25, 1 / 1.25, 2, 0.4]) {
        const anchorX = 313;
        const anchorY = 187;
        const before = screenToWorld(vp, anchorX, anchorY);
        const after = screenToWorld(zoomAt(vp, anchorX, anchorY, factor), anchorX, anchorY);
        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.y).toBeCloseTo(before.y, 9);
      }
    }
  });

  it('倍率がクランプされてもアンカーは動かない（上限・下限に張り付いても絵が流れない）', () => {
    const atMax: Viewport = { x: 30, y: -10, scale: MAX_SCALE };
    const atMin: Viewport = { x: 30, y: -10, scale: MIN_SCALE };
    const anchorX = 500;
    const anchorY = 250;

    for (const vp of [atMax, atMin]) {
      const factor = vp.scale === MAX_SCALE ? 4 : 0.05;
      const zoomed = zoomAt(vp, anchorX, anchorY, factor);
      expect(zoomed.scale).toBe(vp.scale);
      const before = screenToWorld(vp, anchorX, anchorY);
      const after = screenToWorld(zoomed, anchorX, anchorY);
      expect(after.x).toBeCloseTo(before.x, 9);
      expect(after.y).toBeCloseTo(before.y, 9);
    }
  });

  it('倍率が範囲外に出ない', () => {
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, 0, 0, 1000).scale).toBe(MAX_SCALE);
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, 0, 0, 0.0001).scale).toBe(MIN_SCALE);
  });

  it('往復ズームで元のビューポートに戻る', () => {
    const vp: Viewport = { x: 44, y: 91, scale: 1 };
    const round = zoomAt(zoomAt(vp, 200, 150, 1.25), 200, 150, 1 / 1.25);
    expect(round.x).toBeCloseTo(vp.x, 9);
    expect(round.y).toBeCloseTo(vp.y, 9);
    expect(round.scale).toBeCloseTo(vp.scale, 9);
  });
});

describe('zoomTo', () => {
  it('アンカーを固定したまま倍率を絶対値で設定する', () => {
    const vp: Viewport = { x: -60, y: 120, scale: 0.75 };
    const anchorX = 400;
    const anchorY = 300;
    const before = screenToWorld(vp, anchorX, anchorY);
    const reset = zoomTo(vp, 1, anchorX, anchorY);

    expect(reset.scale).toBe(1);
    const after = screenToWorld(reset, anchorX, anchorY);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });
});

describe('panBy', () => {
  it('倍率を変えずに screen px 分だけ動かす', () => {
    expect(panBy({ x: 10, y: 20, scale: 2 }, -5, 7)).toEqual({ x: 5, y: 27, scale: 2 });
  });

  it('パンしても world 上の距離感（倍率）は変わらない', () => {
    const vp: Viewport = { x: 0, y: 0, scale: 1.5 };
    const panned = panBy(vp, 100, -40);
    const a = screenToWorld(vp, 0, 0);
    const b = screenToWorld(vp, 300, 300);
    const a2 = screenToWorld(panned, 100, -40);
    const b2 = screenToWorld(panned, 400, 260);
    expect(a2.x).toBeCloseTo(a.x, 9);
    expect(b2.y).toBeCloseTo(b.y, 9);
  });
});

describe('fitBounds', () => {
  it('矩形の中心が画面中心に来る', () => {
    const bounds = { x: 100, y: 200, width: 400, height: 300 };
    const size = { width: 1000, height: 800 };
    const vp = fitBounds(bounds, size);
    const center = worldToScreen(vp, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    expect(center.x).toBeCloseTo(size.width / 2, 6);
    expect(center.y).toBeCloseTo(size.height / 2, 6);
  });

  it('padding を含めて矩形全体が画面に収まる', () => {
    const bounds = { x: -500, y: -200, width: 2400, height: 1600 };
    const size = { width: 900, height: 600 };
    const padding = 64;
    const vp = fitBounds(bounds, size, padding);

    const topLeft = worldToScreen(vp, bounds.x, bounds.y);
    const bottomRight = worldToScreen(vp, bounds.x + bounds.width, bounds.y + bounds.height);
    expect(topLeft.x).toBeGreaterThanOrEqual(padding - 0.001);
    expect(topLeft.y).toBeGreaterThanOrEqual(padding - 0.001);
    expect(bottomRight.x).toBeLessThanOrEqual(size.width - padding + 0.001);
    expect(bottomRight.y).toBeLessThanOrEqual(size.height - padding + 0.001);
  });

  it('極端に小さい矩形でも倍率が上限を超えない', () => {
    const vp = fitBounds({ x: 0, y: 0, width: 1, height: 1 }, { width: 1200, height: 900 });
    expect(vp.scale).toBe(MAX_SCALE);
  });

  it('極端に大きい矩形でも倍率が下限を下回らない', () => {
    const vp = fitBounds(
      { x: 0, y: 0, width: 999999, height: 999999 },
      { width: 800, height: 600 },
    );
    expect(vp.scale).toBe(MIN_SCALE);
  });

  it('サイズ 0 の矩形でも NaN を返さない', () => {
    const vp = fitBounds({ x: 10, y: 10, width: 0, height: 0 }, { width: 800, height: 600 });
    expect(Number.isFinite(vp.x)).toBe(true);
    expect(Number.isFinite(vp.y)).toBe(true);
    expect(Number.isFinite(vp.scale)).toBe(true);
  });
});

describe('unionBounds', () => {
  it('全ての矩形を包む最小の矩形を返す', () => {
    expect(
      unionBounds([
        { x: 10, y: 10, width: 100, height: 50 },
        { x: -20, y: 80, width: 40, height: 40 },
      ]),
    ).toEqual({ x: -20, y: 10, width: 130, height: 110 });
  });

  it('空配列なら null（＝全体表示するものが無い）', () => {
    expect(unionBounds([])).toBeNull();
  });

  it('1枚だけならその矩形そのもの', () => {
    const only = { x: 5, y: 6, width: 7, height: 8 };
    expect(unionBounds([only])).toEqual(only);
  });
});

describe('clampScale / normalizeViewport', () => {
  it('倍率を範囲内に収める', () => {
    expect(clampScale(0.001)).toBe(MIN_SCALE);
    expect(clampScale(100)).toBe(MAX_SCALE);
    expect(clampScale(1.5)).toBe(1.5);
  });

  it('NaN / Infinity は等倍に落とす（壊れた保存値で画面が消えない）', () => {
    // 有限でない値はクランプせず等倍に倒す。Infinity を MAX_SCALE に丸めると
    // 「壊れた保存値で最大ズームのまま開く」という直しにくい状態になるため。
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampScale(Number.NEGATIVE_INFINITY)).toBe(1);
    expect(normalizeViewport({ x: Number.NaN, y: 5, scale: Number.NaN })).toEqual({
      x: 0,
      y: 5,
      scale: 1,
    });
  });
});

describe('viewportCenterWorld', () => {
  it('画面中心の world 座標を返す（新規カードの配置位置）', () => {
    const vp: Viewport = { x: -100, y: -50, scale: 2 };
    const center = viewportCenterWorld(vp, { width: 800, height: 600 });
    expect(center).toEqual(screenToWorld(vp, 400, 300));
  });
});
