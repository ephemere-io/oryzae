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
/**
 * 小さくしても読める下限。
 *
 * **上限は設けない。** 一度は「1 枚が見出しにならないように」と 44px で頭打ちにしたが、
 * カードを大きくしたのは利用者なので、そこで止めると「広げたのに大きくならない」に
 * なる（レビュー指摘）。枠の大きさがそのまま文字の大きさになる。
 */
const MIN_FONT_SIZE = 12;

export function snippetFontSize(cardWidth: number, baseFontSize: number): number {
  if (!Number.isFinite(cardWidth) || cardWidth <= 0) return baseFontSize;
  const scaled = (cardWidth / DEFAULT_CARD_WIDTH) * baseFontSize;
  return Math.round(Math.max(MIN_FONT_SIZE, scaled));
}
