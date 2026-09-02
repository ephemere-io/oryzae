/**
 * 題を、与えられた長さの筋に収める寸法（字の大きさ／何筋使うか）を決める。
 *
 * 縦書きなら筋は「桁」で、筋の長さは画面の高さ。横書きなら筋は「行」で、筋の長さは
 * 1行の幅。**向きが違うだけで規則は同じ**なので、ここは向きを知らない。
 *
 * 題の長さは書き手が決めることなので、**字数に上限を設けない**。代わりに、題が紙を
 * 占領しないよう**筋の数に上限を置き**、そこへ収まるまで字を小さくする:
 *
 *  1. **本文と同じ大きさのまま、筋を増やす**（最大3筋）。題は本文より小さくしたくない
 *  2. 3筋でも入らなければ、**入る大きさまで字を落とす**（下限 10px）
 *
 * 筋を無制限に増やすと長い題が紙の半分を覆い、字を無制限に小さくすると読めなくなる。
 * どちらも上限を持つので、下限の字でも3筋に入らない極端な題（標準的な画面で 165 字超）は
 * 見切れる。そこまで来ると「題ではなく本文」なので、収める努力より紙を守るほうを採る。
 */

/** 題が使える筋の数の上限。これ以上増やすと、題が紙の面積を占領する。 */
const MAX_LINES = 3;

/** これ以上小さいと題に見えない。 */
export const TITLE_MIN_FONT_SIZE = 10;

interface TitleMetricsInput {
  /** 題の字数。0 でも 1 として扱う（空でも1文字ぶんの箱は要る）。 */
  length: number;
  /** 本文の字の大きさを基準にした、題の最大の大きさ。 */
  baseFontSize: number;
  /** 1筋に使える長さ（px）。縦書きなら桁の高さ、横書きなら行の幅。測れていなければ 0。 */
  lineLength: number;
}

export interface TitleMetrics {
  fontSize: number;
  /** 使う筋の数（縦書きなら桁、横書きなら行）。 */
  lines: number;
}

function charsPerLine(lineLength: number, fontSize: number): number {
  return Math.max(1, Math.floor((lineLength * 0.94) / fontSize));
}

export function measureTitle({
  length,
  baseFontSize,
  lineLength,
}: TitleMetricsInput): TitleMetrics {
  const chars = Math.max(1, length);
  // 長さがまだ測れていないうちは、本文と同じ大きさの1筋に倒す（次の描画で測り直る）。
  if (lineLength <= 0) return { fontSize: baseFontSize, lines: 1 };

  // 1) 本文と同じ大きさのまま、筋を増やす
  const perLineAtBase = charsPerLine(lineLength, baseFontSize);
  const lines = Math.min(MAX_LINES, Math.max(1, Math.ceil(chars / perLineAtBase)));
  if (chars <= perLineAtBase * lines) return { fontSize: baseFontSize, lines };

  // 2) 上限の筋数でも入らないぶんは、入る大きさまで字を落とす
  //
  // 割り算の答えをそのまま使わない。1筋に入る字数は floor で切り捨てられるので、
  // 「計算上はぴったり」でも実際には1文字あふれることがある（実測で発生した）。
  // 見積もりから始めて、**本当に収まるまで**1pxずつ下げる。
  let fontSize = Math.min(baseFontSize, Math.floor((lineLength * 0.94 * lines) / chars));
  while (fontSize > TITLE_MIN_FONT_SIZE && chars > charsPerLine(lineLength, fontSize) * lines) {
    fontSize -= 1;
  }
  return { fontSize: Math.max(TITLE_MIN_FONT_SIZE, fontSize), lines };
}
