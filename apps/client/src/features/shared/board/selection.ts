import type { Bounds } from '@/lib/canvas/viewport';
import type { BoardCardData } from './types';

/**
 * 盤面で**複数のカードをまとめて扱う**ときの算数（端末非依存・純粋関数）。
 *
 * 置き場を UI から離してあるのは、ここが「掴んだ角の反対側を固定して等方に伸ばす」
 * という**幾何の規則**だからで、ポインタの出どころ（マウス / 指）には関係がない。
 * DOM 無しで検査できるので、壊れ方が目で見えない拡大縮小の計算をテストで固定できる。
 */

/** 掴める角。カード 1 枚のときと同じ名前を使う。 */
export type ResizeCorner = 'se' | 'sw' | 'ne' | 'nw';

/** カード 1 枚の最小辺（world）。`boardCardUpdateSchema` の下限と揃える。 */
export const MIN_CARD_SIZE = 120;

/** 位置と大きさだけを見る最小の形。テストからも組み立てやすいように独立させる。 */
export interface CardGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Shift クリックの結果の選択。**既に入っていれば外す、入っていなければ足す。**
 *
 * 外す側を持たないと「Shift で選びすぎたときに戻せない」状態になり、選び直しに
 * 一度空きを押させることになる。
 */
export function toggleSelection(ids: readonly string[], cardId: string): string[] {
  return ids.includes(cardId) ? ids.filter((id) => id !== cardId) : [...ids, cardId];
}

/** 選んでいるカードを囲む world 矩形。1 枚も無ければ `null`。 */
export function selectionBounds(
  cards: readonly BoardCardData[],
  ids: readonly string[],
): Bounds | null {
  const chosen = cards.filter((card) => ids.includes(card.id) && !card.removing);
  if (chosen.length === 0) return null;

  const left = Math.min(...chosen.map((card) => card.x));
  const top = Math.min(...chosen.map((card) => card.y));
  const right = Math.max(...chosen.map((card) => card.x + card.width));
  const bottom = Math.max(...chosen.map((card) => card.y + card.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 掴んだ角の**反対側**（動かさない点）。 */
function anchorOf(box: Bounds, corner: ResizeCorner): { x: number; y: number } {
  return {
    x: corner.includes('w') ? box.x + box.width : box.x,
    y: corner.includes('n') ? box.y + box.height : box.y,
  };
}

/**
 * 群を拡大縮小する倍率。
 *
 * **縦横ばらばらには伸ばさない。** カードは1枚ずつ傾いて（rotation）いるので、縦横を
 * 別々に伸ばすと傾いたカードが歪む（矩形では表せない形になる）。掴んだ角を対角へ
 * 引いた量を縦横で平均し、**等方**の倍率 1 つにする。
 *
 * 小さい側は、群のどのカードも `MIN_CARD_SIZE` を割らないところで止める。
 */
export function groupScaleFactor(
  starts: readonly CardGeometry[],
  box: Bounds,
  corner: ResizeCorner,
  dx: number,
  dy: number,
): number {
  if (box.width <= 0 || box.height <= 0 || starts.length === 0) return 1;

  const signX = corner.includes('e') ? 1 : -1;
  const signY = corner.includes('s') ? 1 : -1;
  const factorX = (box.width + dx * signX) / box.width;
  const factorY = (box.height + dy * signY) / box.height;
  const factor = (factorX + factorY) / 2;

  const smallestSide = Math.min(...starts.map((card) => Math.min(card.width, card.height)));
  const lowerBound = smallestSide > 0 ? MIN_CARD_SIZE / smallestSide : 1;
  return Math.max(factor, lowerBound);
}

/**
 * 群を、掴んだ角の反対側を固定したまま等方に拡大縮小した結果。
 *
 * カード同士の**間隔も一緒に伸びる**（位置を固定点からの距離ごと掛ける）。間隔を
 * そのままにすると、縮めたときにカードが重なり、広げたときに隙間だけが空いて、
 * 貼った関係が崩れる。
 */
export function scaleSelection(
  starts: readonly CardGeometry[],
  box: Bounds,
  corner: ResizeCorner,
  dx: number,
  dy: number,
): CardGeometry[] {
  const factor = groupScaleFactor(starts, box, corner, dx, dy);
  const anchor = anchorOf(box, corner);

  return starts.map((card) => ({
    id: card.id,
    x: Math.round(anchor.x + (card.x - anchor.x) * factor),
    y: Math.round(anchor.y + (card.y - anchor.y) * factor),
    width: Math.round(card.width * factor),
    height: Math.round(card.height * factor),
  }));
}
