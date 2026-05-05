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

function dayName(date: Date, t: (key: string) => string): string {
  return t(DAY_KEYS[date.getDay()]);
}

function formatYmd(date: Date): string {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

export function formatEntryDate(created: Date, updated: Date, t: (key: string) => string): string {
  if (isSameDay(created, updated)) {
    return `${formatYmd(created)} — ${dayName(created, t)} ${formatTime(created)} · ${formatTime(updated)}`;
  }
  return `${formatYmd(created)} ${dayName(created, t)} ${formatTime(created)} — ${formatYmd(updated)} ${dayName(updated, t)} ${formatTime(updated)}`;
}
