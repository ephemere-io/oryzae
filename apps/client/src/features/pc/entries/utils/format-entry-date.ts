const DAY_KEYS = [
  'date.day_sun',
  'date.day_mon',
  'date.day_tue',
  'date.day_wed',
  'date.day_thu',
  'date.day_fri',
  'date.day_sat',
] as const;

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 分まで同じか。秒より細かい差は、読む側にとって「同じ時刻」。 */
function isSameMinute(a: Date, b: Date): boolean {
  return isSameDay(a, b) && a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
}

function dayName(date: Date, t: (key: string) => string): string {
  return t(DAY_KEYS[date.getDay()]);
}

function formatYmd(date: Date): string {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

/**
 * エントリーの日付。ヘッダーに小さく出す「このエントリーがいつのものか」。
 *
 * 書き始めた時刻と最後に触った時刻が同じなら、**片方しか出さない**。
 * 以前は同じ日なら常に両方を並べていたので、新規エントリ（作成＝更新）が
 * `19:18 · 19:18` と同じ時刻を2回出していた。
 *
 * 差があるときだけ `→` で繋ぐ。`·` は区切りとしては弱く、範囲にも並列にも読めた。
 */
export function formatEntryDate(created: Date, updated: Date, t: (key: string) => string): string {
  const head = `${formatYmd(created)} — ${dayName(created, t)} ${formatTime(created)}`;

  if (isSameMinute(created, updated)) return head;
  if (isSameDay(created, updated)) return `${head} → ${formatTime(updated)}`;

  return `${head} → ${formatYmd(updated)} ${dayName(updated, t)} ${formatTime(updated)}`;
}
