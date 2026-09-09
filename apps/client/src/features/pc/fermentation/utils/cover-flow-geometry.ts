/**
 * 発酵履歴（Cover Flow）の幾何。
 *
 * 円盤の位置・大きさも、日付レールに並べる範囲も、**キャンバスの実測サイズ**から出す
 * （固定 px にしない）。描画から切り離した純関数にしてあるのは、扇の配置・ヒットテスト・
 * レールの窓がどれも数式の塊で、DOM を立てずに確かめられる方が壊れにくいから。
 */

/** 隣の円盤を向こう向きに倒す角度。 */
const TILT_DEG = 46;
/**
 * 正面の円盤の直径の上限・下限。
 *
 * 幅の係数は **扇の余地を残すため**にある。詳細列を開くとキャンバス列は 880px 前後に
 * なるが、以前の 0.55 では円盤だけで 484px（列の 55%）を占め、隣の円盤が置ける場所が
 * 残らなかった。高さ側（`vh * 0.52`）は下の日付レールを避けるための係数。
 */
const DISC_MIN = 200;
const DISC_MAX = 480;

/** 列の縁に残す余白。ここまで円盤を出さない。 */
const EDGE_MARGIN = 48;
/** 遠い段を積み上げる奥行き。ここに「まだ続いている」ことを見せる。 */
const PILE_DEPTH = 60;
/** 積み上げ 1 段ぶんのずれ。 */
const PILE_STEP = 14;

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
  return Math.max(DISC_MIN, Math.min(canvas.width * 0.46, canvas.height * 0.52, DISC_MAX));
}

/** 隣の円盤の箱の一辺。正面の 0.72 倍（上限 360）。 */
function neighbourSize(disc: number): number {
  return Math.min(360, disc * 0.72);
}

/**
 * 隣の円盤が実際に食う横幅の半分。
 *
 * `scale(0.8)` で縮むうえ、`rotateY` で向こう向きに倒れているぶん **横には短く写る**
 * （cos 46° ≒ 0.69）。箱の寸法そのままで場所を取ると、実際の見え方より内側に置くことに
 * なり、隣が正面の陰から出てこない。
 */
export function neighbourHalfWidth(canvas: CanvasSize): number {
  const disc = discSize(canvas);
  return (neighbourSize(disc) * 0.8 * Math.cos((TILT_DEG * Math.PI) / 180)) / 2;
}

/** いちばん外側に置ける中心 x。列の縁の余白と、積み上げのぶんを残す。 */
function outerReach(disc: number, canvas: CanvasSize): number {
  const half = neighbourHalfWidth(canvas);
  return Math.max(disc * 0.5, canvas.width / 2 - EDGE_MARGIN - half - PILE_DEPTH);
}

/**
 * 円盤 1 枚の配置。
 *
 * `offset` は正面からの段数（負が過去、正が未来）。
 *
 * **隣は必ず正面の縁から覗く**ところに置く。以前は「いちばん遠い段まで画面に収める」
 * 式にしていたため、履歴が増えるほど間隔が反比例で潰れ、21 件では隣の中心が 35px ＝
 * 半径 216px の正面の円盤に完全に埋まっていた。件数がいくつでも隣が見えないのでは
 * 「めくれる束」に見えない。
 *
 * その代わり、2 段目から先は**外側へ積み上げる**（`PILE_DEPTH` まで）。扇として並べ
 * きれない列幅でも、縁に重なった円盤の厚みが「まだ続いている」ことを見せる。
 */
export function discPlacement(offset: number, canvas: CanvasSize): DiscPlacement {
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

  const reach = outerReach(disc, canvas);
  // 1 段目は外側いっぱい。2 段目から先はそこへ積む（頭打ちさせて列の外へ出さない）。
  const translateX = sign * (reach + Math.min(PILE_DEPTH, (away - 1) * PILE_STEP));

  return {
    size: Math.round(neighbourSize(disc)),
    translateX,
    translateZ: -150 - (away - 1) * 90,
    rotateY: -sign * TILT_DEG,
    scale: Math.max(0.5, 0.8 - (away - 1) * 0.07),
    zIndex: 50 - away,
    opacity: Math.max(0.34, 0.78 - (away - 1) * 0.13),
  };
}

/**
 * 正面の円盤の縁から、隣の円盤が何 px はみ出して見えるか。
 * 0 以下なら隣は完全に隠れている ＝ 束に見えない。
 */
export function neighbourPeek(canvas: CanvasSize): number {
  const disc = discSize(canvas);
  return outerReach(disc, canvas) + neighbourHalfWidth(canvas) - disc / 2;
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

/**
 * 日付レールに並べるチップの最大数。
 *
 * レールは列の中に収まっていなければならない。以前は全件を横に並べていたため、20 件を
 * 超えると列からはみ出し、**右の詳細列に重なって**左端は見切れていた（レールは z-70 で
 * 詳細列より手前に描かれるため、覆い隠していた）。
 */
const RAIL_MAX_ITEMS = 9;

/**
 * いま見ている段を **できるだけ中央に**置いた窓を返す。
 *
 * 端に寄ったときは窓を内側へ寄せる（中央固定にすると窓の半分が空になる）。
 * 窓の外にまだ段が残っているかどうかも返し、呼び出し側が「…」を出すのに使う。
 */
export function railWindow(
  index: number,
  total: number,
  max: number = RAIL_MAX_ITEMS,
): { start: number; end: number; hasBefore: boolean; hasAfter: boolean } {
  if (total <= max) return { start: 0, end: total, hasBefore: false, hasAfter: false };
  const half = Math.floor(max / 2);
  const start = Math.min(Math.max(index - half, 0), total - max);
  const end = start + max;
  return { start, end, hasBefore: start > 0, hasAfter: end < total };
}

/** ゴースト瓶の箱。円盤に追従しつつ、キャンバスより高くならない。 */
export function ghostJarBox(canvas: CanvasSize): { width: number; height: number } {
  const height = Math.min(discSize(canvas) * 1.4, canvas.height - 120);
  return { width: Math.round(height * 0.8), height: Math.round(height) };
}
