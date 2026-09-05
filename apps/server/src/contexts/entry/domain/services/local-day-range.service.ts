/**
 * 「利用者のローカル暦日」を UTC の区間に変換する（純粋関数・依存なし）。
 *
 * ボードは `dateKey`（YYYY-MM-DD）で「その日」のエントリを集める。クライアントは
 * ローカル時刻で dateKey を作るのに対し、`entries.created_at` は UTC 保存であるため、
 * dateKey をそのまま UTC の 00:00〜24:00 とみなすとズレる。
 *
 * 例（JST = UTC+9, tzOffsetMinutes = -540）:
 *   JST 2026-08-10 00:50 の投稿 → created_at = 2026-08-09T15:50Z
 *   dateKey "2026-08-10" を UTC 窓とすると 2026-08-10T00:00Z 以降なので**取りこぼす**。
 *   → JST 00:00〜09:00 に書いたエントリが当日のボードに出ない不具合になっていた。
 *
 * `tzOffsetMinutes` は JS の `Date.prototype.getTimezoneOffset()` と同じ符号
 * （UTC − ローカル の分数。JST なら -540）。未指定（0）なら従来どおり UTC 基準。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UtcInstantRange {
  /** 区間の開始（含む）。ISO8601。 */
  startUtc: string;
  /** 区間の終端（含まない）。ISO8601。 */
  endUtc: string;
}

function localMidnightUtcMs(dateKey: string, tzOffsetMinutes: number): number {
  const asUtcMidnight = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(asUtcMidnight)) {
    throw new Error(`Invalid dateKey: ${dateKey}`);
  }
  // ローカル 00:00 の実時刻 = 同日 00:00 UTC + offset（JST は -540 分 → 前日 15:00Z）
  return asUtcMidnight + tzOffsetMinutes * 60_000;
}

/** `dateKey` が指すローカル暦日 1 日ぶんの UTC 区間。 */
export function localDayRange(dateKey: string, tzOffsetMinutes = 0): UtcInstantRange {
  const start = localMidnightUtcMs(dateKey, tzOffsetMinutes);
  return {
    startUtc: new Date(start).toISOString(),
    endUtc: new Date(start + DAY_MS).toISOString(),
  };
}

/**
 * UTC の瞬間（`entries.created_at`）が、利用者のローカル暦では何年何月かを返す（`YYYY-MM`）。
 *
 * 書斎の手帳は「月」で 1 冊になる（docs/oryzae-study）。`created_at` を UTC のまま
 * 月に丸めると、JST の利用者が月初 00:00〜09:00 に書いた記録が**前月の冊に落ちる**
 * — `localDayRange` が日で踏んだのと同じズレを、月でもう一度踏むことになる。
 *
 * `tzOffsetMinutes` の符号は `localDayRange` と同じ（UTC − ローカル の分数。JST は -540）。
 * 不正な日時は null を返す（呼び出し側が黙って捨てられるように。集計が 1 行落ちることは
 * あっても、壊れた 1 行で月別集計そのものを失敗させない）。
 */
export function localMonthKey(createdAtIso: string, tzOffsetMinutes = 0): string | null {
  const at = Date.parse(createdAtIso);
  if (Number.isNaN(at)) return null;
  // ローカル壁時計 = 実時刻 − offset（JST は -540 分なので +9 時間される）。
  const local = new Date(at - tzOffsetMinutes * 60_000);
  const year = local.getUTCFullYear();
  const month = `${local.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * `YYYY-MM` が指すローカル暦月 1 ヶ月ぶんの UTC 区間。
 *
 * 書斎の一覧が「その月の記録」を引くのに使う。件数（`countByMonth` → `localMonthKey`）と
 * **同じ月の切り方**でなければならない。ここがずれると、手帳の厚みが言う件数と一覧の
 * 件数が食い違う（月初 00:00〜09:00 の記録が、片方では当月・片方では前月に入る）。
 */
export function localMonthRange(month: string, tzOffsetMinutes = 0): UtcInstantRange {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid month: ${month}`);
  }
  const start = localMidnightUtcMs(`${month}-01`, tzOffsetMinutes);
  // 翌月 1 日のローカル 00:00。年跨ぎは Date の桁上がりに任せる。
  const [year, monthIndex] = month.split('-').map(Number);
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  const nextKey = `${nextYear}-${`${nextMonth}`.padStart(2, '0')}-01`;
  const end = localMidnightUtcMs(nextKey, tzOffsetMinutes);
  return {
    startUtc: new Date(start).toISOString(),
    endUtc: new Date(end).toISOString(),
  };
}

/** `dateKey` を含むローカルの週（月曜始まり）1 週間ぶんの UTC 区間。 */
export function localWeekRange(dateKey: string, tzOffsetMinutes = 0): UtcInstantRange {
  const start = localMidnightUtcMs(dateKey, tzOffsetMinutes);
  // 曜日はローカル暦日で判定する（UTC に寄せると週境界がずれる）。
  const localDow = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  const daysSinceMonday = (localDow + 6) % 7;
  const monday = start - daysSinceMonday * DAY_MS;
  return {
    startUtc: new Date(monday).toISOString(),
    endUtc: new Date(monday + 7 * DAY_MS).toISOString(),
  };
}
