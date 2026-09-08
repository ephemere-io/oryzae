/**
 * UTC 日と JST 表記のユーティリティ（純粋関数）。
 *
 * コストの日次レポートは **UTC 日を 1 つの窓** として切る。Anthropic の cost_report が
 * UTC 日バケット固定で JST 日に切れないため、実額に合わせて発酵の件数も同じ窓で数える。
 * 窓を 2 つ（実額は UTC 日・件数は JST 日）にすると、レポート冒頭で毎回その対応関係を
 * 説明する羽目になり、読む人は「何時から何時の話か」が分からなくなる
 * （#584 のレポートへの指摘）。
 *
 * UTC 日 D は JST では「D 9:00 〜 D+1 9:00」。定期発酵（JST 03:00 = UTC 18:00）は
 * D+1 未明のぶんが窓に入る。表示は jstTimeRangeOfUtcDay() で JST の時刻範囲にして出し、
 * 「UTC」という語を読む人に見せない。
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** その時刻の UTC 日 (YYYY-MM-DD)。 */
export function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC 日 (YYYY-MM-DD) を [00:00:00.000Z, 翌日 00:00:00.000Z) の Date 組に変換する。 */
export function utcDayBounds(dateKey: string): { start: Date; end: Date } {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/**
 * UTC 日を Supabase の created_at (timestamptz) で絞るための ISO 区間。
 * gte/lte（両端含む）で使うので、終端は翌日 0:00 の 1ms 手前。
 */
export function utcDayRangeIso(dateKey: string): { startIso: string; endIso: string } {
  const { start, end } = utcDayBounds(dateKey);
  return { startIso: start.toISOString(), endIso: new Date(end.getTime() - 1).toISOString() };
}

/**
 * UTC 日 (YYYY-MM-DD) の前日。
 * 日次レポートの対象日（実行時刻の直前に閉じた UTC 日）と、前日比の参照に使う。
 */
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

/** JST の「M/D H:MM」。 */
function jstClock(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const minutes = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${jst.getUTCHours()}:${minutes}`;
}

/**
 * UTC 日を JST の時刻範囲として書く。'2026-09-07' → '9/7 9:00 〜 9/8 9:00 (JST)'。
 * 「UTC 9/7」と書いても日本の読み手には何時から何時の話か分からない。
 */
export function jstTimeRangeOfUtcDay(dateKey: string): string {
  const { start, end } = utcDayBounds(dateKey);
  return `${jstClock(start)} 〜 ${jstClock(end)} (JST)`;
}
