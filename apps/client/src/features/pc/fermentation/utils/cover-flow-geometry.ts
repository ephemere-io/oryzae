/**
 * 発酵履歴（Cover Flow）の幾何。
 *
 * 円盤の位置・大きさは **キャンバスの実測サイズ** から出す（固定 px にしない）。
 * 描画から切り離した純関数にしてあるのは、扇の配置とヒットテストが数式の塊で、
 * DOM を立てずに確かめられる方が壊れにくいから。
 */

/** 円盤どうしの基準の間隔（px）。扇の広がりの素の値。 */
const SPREAD = 330;
/** 隣の円盤を向こう向きに倒す角度。 */
const TILT_DEG = 46;
/** 正面の円盤の直径の上限・下限。 */
const DISC_MIN = 200;
const DISC_MAX = 442;

export interface CanvasSize {
  width: number;
  height: number;
}

/** 円盤 1 枚の見た目（正面からの段数 offset で決まる）。 */
export interface DiscPlacement {
  /** 箱の一辺（px）。正面だけ大きく、隣は一律に縮む。 */
  size: number;
  translateX: number;
  translateZ: number;
  rotateY: number;
  scale: number;
  zIndex: number;
  opacity: number;
}

/**
 * 正面の円盤の直径。ゴースト瓶の高さも扇の広がりもここを基準にする。
 */
export function discSize(canvas: CanvasSize): number {
  return Math.max(DISC_MIN, Math.min(canvas.width * 0.55, canvas.height * 0.52, DISC_MAX));
}

/**
 * 円盤 1 枚の配置。
 *
 * `offset` は正面からの段数（負が過去、正が未来）。`maxOffset` は正面から
 * いちばん遠い円盤の段数で、扇の幅をキャンバスに収めるために要る。
 *
 * x は **段ごとに必ず違う値**にする。一律に上限でクランプすると、遠い段どうしが
 * 同じ位置に重なって団子になる（プロトタイプで踏んだ）。
 */
export function discPlacement(
  offset: number,
  maxOffset: number,
  canvas: CanvasSize,
): DiscPlacement {
  const disc = discSize(canvas);
  const away = Math.abs(offset);
  const sign = offset === 0 ? 0 : Math.sign(offset);

  if (away === 0) {
    return {
      size: Math.round(disc),
      translateX: 0,
      translateZ: 0,
      rotateY: 0,
      scale: 1,
      zIndex: 50,
      opacity: 1,
    };
  }

  // 扇の幅: 画面半分から少し引いた「届く範囲」に、いちばん遠い段まで収める。
  const far = Math.max(1, maxOffset);
  const reach = Math.max(150, canvas.width / 2 - 34);
  const span = Math.max(80, reach - disc * 0.32);
  const step = Math.min(SPREAD * 1.15, span / (1 + (far - 1) * 0.35));

  return {
    size: Math.round(Math.min(360, disc * 0.72)),
    translateX: sign * step * (1 + (away - 1) * 0.35),
    translateZ: -150 - (away - 1) * 90,
    rotateY: -sign * TILT_DEG,
    scale: Math.max(0.5, 0.8 - (away - 1) * 0.07),
    zIndex: 50 - away,
    opacity: Math.max(0.34, 0.78 - (away - 1) * 0.13),
  };
}

/** 正面から最も遠い円盤の段数。扇の幅を決めるのに使う。 */
export function maxOffsetFrom(index: number, total: number): number {
  return Math.max(index, total - 1 - index);
}

/** ヒットテストが受け取る円盤 1 枚の実測矩形。 */
export interface DiscRect {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  zIndex: number;
}

export type StageHit =
  /** その段を正面へ持ってくる。 */
  | { kind: 'goTo'; index: number }
  /** 正面の円盤の中。何もしない（誤って閉じない）。 */
  | { kind: 'ignore' }
  /** 円盤から離れた背景。履歴を閉じる。 */
  | { kind: 'close' };

function grow(rect: DiscRect, factor: number) {
  return {
    left: rect.left - rect.width * factor,
    right: rect.left + rect.width * (1 + factor),
    top: rect.top - rect.height * factor,
    bottom: rect.top + rect.height * (1 + factor),
  };
}

function centerX(rect: DiscRect): number {
  return rect.left + rect.width / 2;
}

/**
 * ステージの背景クリックの行き先を決める。
 *
 * 円盤は 3D で倒して重ねてあるので、見えている絵と当たり判定がずれる。素朴に
 * 「矩形の中か」で判定すると、正面の外周（影の帯）を押したときに履歴が閉じてしまい、
 * 隣をめくるつもりの操作が全部離脱になる。4 段で見る:
 *
 *  1. 正面以外の円盤の矩形（外へ 18% 広げる）に入っていれば、その円盤へ
 *     （重なりは z-index の大きい＝手前を採る）
 *  2. 正面の円盤の **円の中** なら何もしない
 *  3. 正面の矩形（外へ 20%）の中で円の外＝外周の影の帯なら、押した側で最も近い円盤へ
 *  4. それ以外＝円盤から離れた背景なら閉じる
 */
export function hitTestStage(
  point: { x: number; y: number },
  discs: readonly DiscRect[],
  activeIndex: number,
): StageHit {
  const inBox = (b: { left: number; right: number; top: number; bottom: number }) =>
    point.x >= b.left && point.x <= b.right && point.y >= b.top && point.y <= b.bottom;

  const neighbours = discs.filter((d) => d.index !== activeIndex);

  const hit = neighbours.filter((d) => inBox(grow(d, 0.18))).sort((a, b) => b.zIndex - a.zIndex)[0];
  if (hit) return { kind: 'goTo', index: hit.index };

  const active = discs.find((d) => d.index === activeIndex);
  if (active) {
    const dx = point.x - centerX(active);
    const dy = point.y - (active.top + active.height / 2);
    if (Math.sqrt(dx * dx + dy * dy) <= active.width / 2) return { kind: 'ignore' };
    if (inBox(grow(active, 0.2))) {
      const near = neighbours
        .filter((d) => Math.sign(centerX(d) - centerX(active)) === Math.sign(dx))
        .sort((a, b) => Math.abs(centerX(a) - point.x) - Math.abs(centerX(b) - point.x))[0];
      return near ? { kind: 'goTo', index: near.index } : { kind: 'ignore' };
    }
  }

  return { kind: 'close' };
}

/** ゴースト瓶の箱。円盤に追従しつつ、キャンバスより高くならない。 */
export function ghostJarBox(canvas: CanvasSize): { width: number; height: number } {
  const height = Math.min(discSize(canvas) * 1.4, canvas.height - 120);
  return { width: Math.round(height * 0.8), height: Math.round(height) };
}
