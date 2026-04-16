/**
 * Cron は JST 03:00 (UTC 18:00) に発火する。
 * この時点で処理すべきは「直前に閉じた一日」= JST での前日分のエントリ。
 *
 * 例: UTC 2026-04-16T18:00:00Z (= JST 2026-04-17T03:00:00)
 *     → targetDateKey = "2026-04-16" (JST での「昨日」)
 */
export function getFermentationTargetDateKey(now: Date): string {
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffsetMs);
  // 発火時の JST 日付から 1 日引くことで、直前に閉じた一日を対象にする
  jstNow.setUTCDate(jstNow.getUTCDate() - 1);
  return jstNow.toISOString().slice(0, 10);
}
