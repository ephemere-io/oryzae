import type { InlineImage } from '@oryzae/shared';

/**
 * リサイズハンドルのドラッグ量を、保存形式（`widthRatio` / `aspect`）に変換する。
 *
 * **画面の縦横と、本文の縦横は一致しない。** 横書き（horizontal-tb）では
 * inline 軸＝画面の X だが、縦書き（vertical-rl）では inline 軸＝画面の Y になる。
 * ハンドルは画面上の位置（北西・北・北東…）で置くので、掴んだ物理方向を
 * 書字方向に応じて論理軸へ射影しないと、縦書きで「右へ引くと縦に伸びる」ことになる。
 *
 * ここを純粋関数に切り出してあるのは、この射影がテストしづらい pointer イベントの
 * 中に埋まると誰も検証できなくなるため。
 */

/** ハンドルの位置。画面上の見た目に対応する（書字方向に依らない）。 */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** 角のハンドルは縦横比を保つ。辺のハンドルは片方だけ伸ばす（自由変形）。 */
const CORNER_HANDLES: ResizeHandle[] = ['nw', 'ne', 'se', 'sw'];

export function isCornerHandle(handle: ResizeHandle): boolean {
  return CORNER_HANDLES.includes(handle);
}

/** 掴んだハンドルを引いたとき、その物理軸で大きくなる向き（+1 / -1 / 0＝動かさない）。 */
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
  /** ドラッグ開始時点の写真の実寸（px）。 */
  startInlinePx: number;
  startBlockPx: number;
  /** 縦書きか。inline 軸が画面の Y になる。 */
  isVertical: boolean;
}

/** 写真が潰れて掴めなくなるのを防ぐ下限。schema の下限と揃えてある。 */
const MIN_RATIO = 0.05;
const MAX_RATIO = 1;

/**
 * ドラッグ量から新しい `widthRatio` と `aspect` を求める。
 *
 * - 角ハンドル: 縦横比を保つ。inline 軸の変化量だけを見る（`aspect` は触らない）。
 * - 辺ハンドル: 掴んだ軸だけを伸ばす。block 軸を動かしたときだけ `aspect` を書く。
 */
export function resizeInlineImage(input: ResizeInput): Pick<InlineImage, 'widthRatio' | 'aspect'> {
  const { start, handle, dx, dy, editorInlineSize, startInlinePx, startBlockPx, isVertical } =
    input;
  if (editorInlineSize <= 0 || startInlinePx <= 0) {
    return { widthRatio: start.widthRatio, ...(start.aspect ? { aspect: start.aspect } : {}) };
  }

  const sign = physicalSigns(handle);
  // 物理ドラッグを論理軸へ射影する。縦書きは inline 軸が画面 Y。
  //
  // 掴んだ辺と拡大方向の関係は `physicalSigns` が持っている（西を掴んで左へ引けば
  // 大きくなる）。書字方向は「本文がどちらへ流れるか」の話であって、ハンドルを引いた
  // ときに箱が見た目どちらへ伸びるかには影響しない。ここで書字方向による符号反転を
  // 足すと、縦書きだけ逆に縮むようになる。
  const inlineDelta = isVertical ? dy * sign.y : dx * sign.x;
  const blockDelta = isVertical ? dx * sign.x : dy * sign.y;

  if (isCornerHandle(handle)) {
    // 角は比率固定。inline 軸の変化だけを採用し、aspect は据え置く。
    const nextInlinePx = startInlinePx + inlineDelta;
    return {
      widthRatio: clampRatio(nextInlinePx / editorInlineSize),
      ...(start.aspect ? { aspect: start.aspect } : {}),
    };
  }

  const drivesInline = isVertical ? sign.y !== 0 : sign.x !== 0;
  if (drivesInline) {
    // inline 軸だけ伸ばす → 見かけの比率が変わるので aspect を確定させる。
    const nextInlinePx = Math.max(1, startInlinePx + inlineDelta);
    return {
      widthRatio: clampRatio(nextInlinePx / editorInlineSize),
      aspect: startBlockPx / nextInlinePx,
    };
  }

  // block 軸だけ伸ばす → inline は据え置き、aspect だけ動く。
  const nextBlockPx = Math.max(1, startBlockPx + blockDelta);
  return {
    widthRatio: start.widthRatio,
    aspect: nextBlockPx / startInlinePx,
  };
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return MIN_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
}
