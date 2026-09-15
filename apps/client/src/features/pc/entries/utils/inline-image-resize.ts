import type { InlineImage } from '@oryzae/shared';

/**
 * リサイズハンドルのドラッグ量を、保存形式（`widthRatio` / `aspect`）に変換する。
 *
 * **掴んだ辺は、掴んだ方向へ動かす。** 右の辺を右へ引けば幅が増える——書字方向に関係なく、
 * 画面で見たままの箱として扱う。
 *
 * 以前は物理のドラッグを inline / block の論理軸へ射影し、`aspect` も論理の比
 * （block ÷ inline）で持っていた。ところが CSS の `aspect-ratio` は**物理（幅 ÷ 高さ）**
 * なので、縦書きでは縦横が入れ替わる。実測では、右の辺を 80px 右へ引くと幅が
 * 566px → 124px と逆に潰れ、左端が 442px 動いていた。
 *
 * ここでやるのは 2 つだけ:
 *
 *   1. ドラッグ量から**物理の幅と高さ**を出す
 *   2. それを保存形式に直す（`widthRatio` は行に対する割合、`aspect` は幅 ÷ 高さ）
 *
 * 書字方向が要るのは 2 のときだけ。**縦書きでは「行に対する割合」が高さのこと**になる
 * （`inline-size` が高さに効くため）。
 */

/** ハンドルの位置。画面上の見た目に対応する（書字方向に依らない）。 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** 角のハンドルは形を保つ。辺のハンドルは片方だけ伸ばす（自由変形）。 */
const CORNER_HANDLES: ResizeHandle[] = ['nw', 'ne', 'se', 'sw'];

export function isCornerHandle(handle: ResizeHandle): boolean {
  return CORNER_HANDLES.includes(handle);
}

/**
 * 掴んだハンドルを引いたとき、その軸で大きくなる向き（+1 / -1 / 0＝動かさない）。
 *
 * **外へ引けば大きく、内へ引けば小さく。** 右の辺は右へ（+1）、左の辺は左へ（-1）。
 */
function physicalSigns(handle: ResizeHandle): { x: number; y: number } {
  const x = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const y = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  return { x, y };
}

export interface ResizeInput {
  /** ドラッグ開始時の写真。 */
  start: InlineImage;
  /** 掴んだハンドル。 */
  handle: ResizeHandle;
  /** ドラッグ量（画面座標、px）。 */
  dx: number;
  dy: number;
  /** 本文 1 行分の長さ（px）。縦書きなら editor の高さ、横書きなら幅。 */
  editorInlineSize: number;
  /** ドラッグ開始時の写真の実寸（px、画面で見たままの幅と高さ）。 */
  startWidthPx: number;
  startHeightPx: number;
  /** 縦書きか。「行に対する割合」が高さのことになる。 */
  isVertical: boolean;
}

/** 写真が潰れて掴めなくなるのを防ぐ下限。schema の下限と揃えてある。 */
const MIN_RATIO = 0.05;
const MAX_RATIO = 1;
/** 辺を内側へ引き切ったときの下限（px）。0 にすると比が NaN になる。 */
const MIN_SIZE_PX = 8;

/**
 * ドラッグ量から新しい `widthRatio` と `aspect` を求める。
 *
 * - 角ハンドル: 形を保つ。**行に沿う辺の伸び**だけを見る（`aspect` は触らない）
 * - 辺ハンドル: 掴んだ軸だけを伸ばす。形が変わるので `aspect` を書き込む
 */
export function resizeInlineImage(input: ResizeInput): Pick<InlineImage, 'widthRatio' | 'aspect'> {
  const { start, handle, dx, dy, editorInlineSize, startWidthPx, startHeightPx, isVertical } =
    input;
  const unchanged = {
    widthRatio: start.widthRatio,
    ...(start.aspect ? { aspect: start.aspect } : {}),
  };
  // 初期化前などで実寸が取れないことがある。ここで NaN を返すと写真が消える。
  if (editorInlineSize <= 0 || startWidthPx <= 0 || startHeightPx <= 0) return unchanged;

  const sign = physicalSigns(handle);

  if (isCornerHandle(handle)) {
    // 角は形を変えない。行に沿う辺（横書きなら幅、縦書きなら高さ）の伸びで全体を拡げる。
    const alongInline = isVertical ? dy * sign.y : dx * sign.x;
    const startInlinePx = isVertical ? startHeightPx : startWidthPx;
    return {
      widthRatio: clampRatio((startInlinePx + alongInline) / editorInlineSize),
      ...(start.aspect ? { aspect: start.aspect } : {}),
    };
  }

  // 辺は掴んだ軸だけ。左右の辺なら幅、上下の辺なら高さ（もう片方は sign が 0 で動かない）。
  const width = Math.max(MIN_SIZE_PX, startWidthPx + dx * sign.x);
  const height = Math.max(MIN_SIZE_PX, startHeightPx + dy * sign.y);

  // 行に対する割合は頭打ちになる。**その頭打ちを踏まえてから形を出す**
  // （先に形を決めると、行幅で止まったときにもう片方の軸だけが飛ぶ）。
  const ratio = clampRatio((isVertical ? height : width) / editorInlineSize);
  const clampedInlinePx = ratio * editorInlineSize;
  const finalWidth = isVertical ? width : clampedInlinePx;
  const finalHeight = isVertical ? clampedInlinePx : height;

  return { widthRatio: ratio, aspect: finalWidth / finalHeight };
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return MIN_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
}
