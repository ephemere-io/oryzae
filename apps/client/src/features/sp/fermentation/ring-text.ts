/**
 * 円の外周を回る問いテキストの収まり計算（純関数）。
 *
 * SVG の `<textPath>` は経路に収まらない分を **黙って捨てる**。PC は「収まるまで字を
 * 小さくする」で逃げているが、SP では小さくすると読めなくなる（読ませることが目的の
 * テキストなので、本末転倒になる）。
 *
 * そこで SP は逆にする: **読める大きさを先に決めて、入らない分を「…」で畳む**。
 * 切れたのか畳んだのかが見た目で分かるぶん、黙って消えるより誠実。
 */

/** 字送り（em）。収まり計算と描画で同じ値を使う。 */
export const RING_TRACKING = 0.08;

/** SP で読める下限・上限（px）。円が小さくてもこれ以下にはしない。 */
const MIN_FONT = 12;
const MAX_FONT = 17;

/** 円の直径に対する字の大きさ。直径 150 で 15px あたり。 */
const FONT_RATIO = 0.1;

/** 経路の内側に文字を置くぶんの余白（直径からの差）。描画側の半径計算と合わせる。 */
export const RING_INSET = 10;

export interface RingText {
  /** 実際に描く文字列（入らなければ末尾を「…」に畳んだもの）。 */
  label: string;
  /** 描く字の大きさ（px）。 */
  fontSize: number;
  /** 畳んだかどうか。畳んだ円は「全文は開けば読める」ことを示す印を出す。 */
  truncated: boolean;
}

/**
 * 直径 `diameter` の円周に `text` を置くときの、読める字の大きさと収まる文字列。
 *
 * 和文は 1 文字 ≒ 1em として数える。欧文はこれより狭いので早めに畳まれるだけで、
 * はみ出して切れることはない（安全側に倒している）。
 */
export function fitRingText(text: string, diameter: number): RingText {
  const label = text.trim();
  const fontSize = Math.round(Math.min(MAX_FONT, Math.max(MIN_FONT, diameter * FONT_RATIO)));

  const circumference = Math.PI * Math.max(0, diameter - RING_INSET * 2);
  // 一周ぐるりではなく、少し隙間を空ける（始点と終点がぶつかると輪に見えない）。
  const usable = circumference * 0.92;
  const perChar = fontSize * (1 + RING_TRACKING);
  const maxChars = perChar > 0 ? Math.floor(usable / perChar) : 0;

  if (label.length <= maxChars) return { label, fontSize, truncated: false };
  if (maxChars <= 1) return { label: label.length > 0 ? '…' : '', fontSize, truncated: true };
  return { label: `${label.slice(0, maxChars - 1)}…`, fontSize, truncated: true };
}
