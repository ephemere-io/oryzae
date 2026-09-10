/**
 * 発酵履歴のラベル整形。
 *
 * 日付は機械ラベル（Inter / 広いトラッキング）の `2026-08-31` に統一してある。
 * 「2026年08月31日の発酵（最新）」という人が読む行は、日付レールが同じことを見せて
 * いたので畳んだ（そのとき和文への変換も不要になった）。
 */

/** ISO の createdAt → 機械ラベルの 'YYYY-MM-DD'。 */
export function toDateStamp(createdAt: string): string {
  return createdAt.slice(0, 10);
}
