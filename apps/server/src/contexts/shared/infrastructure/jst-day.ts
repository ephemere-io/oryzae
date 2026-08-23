/**
 * JST 日境界のユーティリティ（純粋関数）。
 *
 * Oryzae の運用は JST 基準（発酵 cron は JST 03:00 = UTC 18:00 に走る）なのに、
 * コスト集計だけが UTC 日で切られていた。「8/9 のレポート」が JST 8/10 未明の
 * 発酵を含む、という直感に反するズレが出るため JST 日に統一する。
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** その時刻が JST で何月何日か (YYYY-MM-DD)。 */
function toJstDateKey(date: Date): string {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** JST 前日の日付キー。日次レポートの対象日。 */
export function previousJstDateKey(now: Date): string {
  return toJstDateKey(new Date(now.getTime() - DAY_MS));
}

/**
 * JST 日 (YYYY-MM-DD) を UTC の ISO 区間に変換する。
 * JST 8/9 = UTC [8/8 15:00:00.000Z, 8/9 14:59:59.999Z]。
 * Supabase の created_at は timestamptz なので、この区間で gte/lte すればよい。
 */
export function jstDayRangeUtc(dateKey: string): { startIso: string; endIso: string } {
  const jstMidnightAsUtc = Date.parse(`${dateKey}T00:00:00.000Z`);
  const start = jstMidnightAsUtc - JST_OFFSET_MS;
  return {
    startIso: new Date(start).toISOString(),
    endIso: new Date(start + DAY_MS - 1).toISOString(),
  };
}
