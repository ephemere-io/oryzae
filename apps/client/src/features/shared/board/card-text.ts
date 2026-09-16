/**
 * ボードのカードの文字の大きさ（端末非依存）。
 *
 * **枠を広げたら文字も大きくなる。** 固定サイズだと、盤面を引いて全体を見たときに文字だけが
 * 潰れて読めず、「カードを大きくしたのに読めないまま」になる（実機レビュー指摘）。
 * カードを大きくするという操作が、そのまま「読みやすくする」に繋がるようにする。
 *
 * 基準の大きさは端末で違う（PC は 14px、SP は盤面を縮めて映すぶん 17px）ので、
 * 比率だけをここで共有して基準値は呼び出し側から渡す。
 */

/** 既定のカード幅。この幅のとき基準の文字サイズになる。 */
const DEFAULT_CARD_WIDTH = 262;
/** 小さくしても読める下限と、1 枚が見出しにならない上限。 */
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 44;

export function snippetFontSize(cardWidth: number, baseFontSize: number): number {
  if (!Number.isFinite(cardWidth) || cardWidth <= 0) return baseFontSize;
  const scaled = (cardWidth / DEFAULT_CARD_WIDTH) * baseFontSize;
  return Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, scaled)));
}
