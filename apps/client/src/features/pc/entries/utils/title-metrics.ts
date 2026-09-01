/**
 * 縦書きの題を、桁（画面の高さ）にちょうど収める寸法を決める。
 *
 * 題の長さは書き手が決めることなので、**字数に上限を設けない**。そのぶん、題として
 * 現実的な長さ（標準的な画面で 550 字まで）は見切れない収め方が要る。
 * 手順は3段で、上から順に試す:
 *
 *  1. **本文と同じ大きさのまま、桁を増やす**（最大3桁）。題は本文より小さくしたくない
 *  2. それでも入らなければ、**字を縮める**（下限 12px）。長い題は小さくなって当然
 *  3. 下限に当たってなお入らなければ、**さらに桁を増やす**（最大12桁）。
 *     ここまで来る題は極端に長いので、細い柱が何本か立つ形になる
 *
 * 3 を持たないと、200 字のような題が下限の字でも3桁に入らず、そのまま見切れる。
 */

/** 題が使える桁数の上限（本文と同じ大きさのとき）。これ以上は紙の面積を占領する。 */
const MAX_COLUMNS = 3;

/**
 * 字を下限まで縮めてなお入らないときに許す桁数。細い柱が並ぶ形になる。
 *
 * 12 桁 × 12px は、標準的な画面（桁の高さ 588px）で **550 字ぶん**。題としては
 * 十分に極端な長さで、幅も 230px に収まる。これを超える題は見切れるが、
 * そこまで来ると「題ではなく本文」なので、収める努力より紙を守るほうを採る。
 */
const MAX_COLUMNS_AT_MIN_SIZE = 12;

/** これ以上小さいと題に見えない。 */
export const TITLE_MIN_FONT_SIZE = 12;

interface TitleMetricsInput {
  /** 題の字数。0 でも 1 として扱う（空でも1文字ぶんの箱は要る）。 */
  length: number;
  /** 本文の字の大きさ。題はこれより大きくしない。 */
  baseFontSize: number;
  /** 題が使える桁の高さ（px）。測れていなければ 0。 */
  columnHeight: number;
}

export interface TitleMetrics {
  fontSize: number;
  columns: number;
}

function charsPerColumn(columnHeight: number, fontSize: number): number {
  return Math.max(1, Math.floor((columnHeight * 0.94) / fontSize));
}

export function measureTitle({
  length,
  baseFontSize,
  columnHeight,
}: TitleMetricsInput): TitleMetrics {
  const chars = Math.max(1, length);
  // 高さが測れていないうちは、本文と同じ大きさの1桁に倒す（次の描画で測り直る）。
  if (columnHeight <= 0) return { fontSize: baseFontSize, columns: 1 };

  // 1) 本文と同じ大きさのまま、桁を増やす
  const perColumnAtBase = charsPerColumn(columnHeight, baseFontSize);
  const columns = Math.min(MAX_COLUMNS, Math.max(1, Math.ceil(chars / perColumnAtBase)));
  if (chars <= perColumnAtBase * columns) return { fontSize: baseFontSize, columns };

  // 2) 入らないぶんは字を縮める
  const fontSize = Math.max(
    TITLE_MIN_FONT_SIZE,
    Math.min(baseFontSize, Math.floor((columnHeight * 0.94 * columns) / chars)),
  );
  const perColumn = charsPerColumn(columnHeight, fontSize);
  if (chars <= perColumn * columns) return { fontSize, columns };

  // 3) 下限に当たってなお入らなければ、さらに桁を増やす
  return {
    fontSize,
    columns: Math.min(MAX_COLUMNS_AT_MIN_SIZE, Math.ceil(chars / perColumn)),
  };
}
