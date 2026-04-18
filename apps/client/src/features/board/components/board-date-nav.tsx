'use client';

interface BoardDateNavProps {
  dateKey: string;
  viewType: 'daily' | 'weekly';
  onDateChange: (dateKey: string) => void;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDailyLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return `${dateKey.replace(/-/g, '.')} — ${days[d.getDay()]}`;
}

// Monday–Sunday range, matching server-side weekRange() in load-board.usecase.ts
function weekRange(dateKey: string): { start: string; end: string } {
  const d = new Date(`${dateKey}T00:00:00`);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateKey(monday), end: toDateKey(sunday) };
}

function formatWeeklyLabel(dateKey: string): string {
  const { start, end } = weekRange(dateKey);
  return `${start.replace(/-/g, '.')} — ${end.replace(/-/g, '.')}`;
}

function shiftDate(dateKey: string, offset: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
}

export function BoardDateNav({ dateKey, viewType, onDateChange }: BoardDateNavProps) {
  const offset = viewType === 'weekly' ? 7 : 1;
  const label = viewType === 'weekly' ? formatWeeklyLabel(dateKey) : formatDailyLabel(dateKey);
  return (
    <div
      className="absolute left-6 top-5 z-10 flex items-center gap-3"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <button
        type="button"
        onClick={() => onDateChange(shiftDate(dateKey, -offset))}
        className="flex h-6 w-6 items-center justify-center rounded text-sm transition-colors"
        style={{ color: 'var(--date-color)' }}
      >
        ‹
      </button>
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--date-color)' }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={() => onDateChange(shiftDate(dateKey, offset))}
        className="flex h-6 w-6 items-center justify-center rounded text-sm transition-colors"
        style={{ color: 'var(--date-color)' }}
      >
        ›
      </button>
    </div>
  );
}
