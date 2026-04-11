'use client';

interface BoardDateNavProps {
  dateKey: string;
  onDateChange: (dateKey: string) => void;
}

function formatDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return `${dateKey.replace(/-/g, '.')} — ${days[d.getDay()]}`;
}

function shiftDate(dateKey: string, offset: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function BoardDateNav({ dateKey, onDateChange }: BoardDateNavProps) {
  return (
    <div
      className="absolute left-6 top-5 z-10 flex items-center gap-3"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <button
        type="button"
        onClick={() => onDateChange(shiftDate(dateKey, -1))}
        className="flex h-6 w-6 items-center justify-center rounded text-sm transition-colors"
        style={{ color: 'var(--date-color)' }}
      >
        ‹
      </button>
      <span
        className="text-[10px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--date-color)' }}
      >
        {formatDate(dateKey)}
      </span>
      <button
        type="button"
        onClick={() => onDateChange(shiftDate(dateKey, 1))}
        className="flex h-6 w-6 items-center justify-center rounded text-sm transition-colors"
        style={{ color: 'var(--date-color)' }}
      >
        ›
      </button>
    </div>
  );
}
