/**
 * 発酵履歴のラベル整形。
 *
 * 日付の見せ方は 2 系統ある。機械ラベル（Inter / uppercase / 広いトラッキング）は
 * `2026-08-31`、人が読む行は `2026年08月31日`。同じ日付を 2 か所で違う形に整えるので、
 * 変換はここに寄せて瓶の円と履歴の両方から使う。
 */

/** ISO の createdAt → 機械ラベルの 'YYYY-MM-DD'。 */
export function toDateStamp(createdAt: string): string {
  return createdAt.slice(0, 10);
}

/** 'YYYY-MM-DD' → '2026年08月31日'。形が違えばそのまま返す（壊れた値で欠落させない）。 */
export function toJapaneseDate(stamp: string): string {
  const [year, month, day] = stamp.split('-');
  return year && month && day ? `${year}年${month}月${day}日` : stamp;
}

/** 機械ラベルの件数は 2 桁ゼロ埋め（`04 FERMENTATIONS` / `01 / 04`）。 */
export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
