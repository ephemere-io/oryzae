/**
 * JST 日境界のユーティリティ（純粋関数）。
 *
 * Oryzae の運用は JST 基準（発酵 cron は JST 03:00 = UTC 18:00 に走る）なのに、
 * コスト集計だけが UTC 日で切られていた。「8/9 のレポート」が JST 8/10 未明の
 * 発酵を含む、という直感に反するズレが出るため JST 日に統一する。
 *
 * 注意: Anthropic の cost_report は UTC 日バケット固定で JST 日に切れない。
 * 実額を並べるときは utcDateKeyOfJstFermentationRun() で対応 UTC 日を求め、
 * 「UTC 基準」であることを表示側で明示すること。
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** その時刻が JST で何月何日か (YYYY-MM-DD)。 */
export function toJstDateKey(date: Date): string {
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

/**
 * その JST 日の定期発酵が実際に走った UTC 日を返す。
 *
 * 定期発酵は JST 03:00 (= UTC 前日 18:00) に発火するため、JST 日 D の発酵コストは
 * UTC 日 D-1 に計上される。Anthropic の実額(UTC日バケット)と JST 日のレポートを
 * 突き合わせるための対応付け。
 *
 * 注意: admin からの手動発火やリトライは任意の時刻に走るため、この対応は
 * 「定期発酵ぶんについては正確」という近似である。表示では UTC 日を明示すること。
 */
export function utcDateKeyOfJstFermentationRun(jstDateKey: string): string {
  const utcDay = Date.parse(`${jstDateKey}T00:00:00.000Z`) - DAY_MS;
  return new Date(utcDay).toISOString().slice(0, 10);
}

/** UTC 日 (YYYY-MM-DD) を [00:00:00.000Z, 翌日 00:00:00.000Z) の Date 組に変換する。 */
export function utcDayBounds(dateKey: string): { start: Date; end: Date } {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** UTC 日 (YYYY-MM-DD) の前日。cost_report の日別バケットを前日比で並べるのに使う。 */
export function previousUtcDateKey(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);
}

/**
 * UTC 日 (YYYY-MM-DD) が属する UTC 月の区間と日数。
 * 月累計・月末見込みを出すのに使う。実額が UTC 日バケット固定なので月も UTC で切る。
 */
export function utcMonthBounds(dateKey: string): { start: Date; end: Date; daysInMonth: number } {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  // UTC には DST が無いので、差を DAY_MS で割れば当月日数がそのまま出る。
  return { start, end, daysInMonth: (end.getTime() - start.getTime()) / DAY_MS };
}
