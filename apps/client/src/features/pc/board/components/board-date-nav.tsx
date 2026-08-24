'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';

interface BoardDateNavProps {
  dateKey: string;
  viewType: 'daily' | 'weekly';
  onDateChange: (dateKey: string) => void;
  onViewTypeChange: (viewType: 'daily' | 'weekly') => void;
}

const VIEW_TYPES: { id: 'daily' | 'weekly'; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDailyLabel(dateKey: string, days: readonly string[]): string {
  const d = new Date(`${dateKey}T00:00:00`);
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

/**
 * 盤面左上の日付ナビ＋表示単位（Daily/Weekly）の切り替え。
 *
 * 表示単位はここに同居させる。日付ラベル（1日 or 月〜日の範囲）も送り幅（1日 or 7日）も
 * viewType で変わるため、離すと「今どちらを見ているか」と「どこへ動くか」が別々の場所に
 * 散る。作成系の道具は下部の BoardToolbar が持つ。
 */
export function BoardDateNav({
  dateKey,
  viewType,
  onDateChange,
  onViewTypeChange,
}: BoardDateNavProps) {
  const t = useTranslations('board');
  const days = [
    t('date.day_sun'),
    t('date.day_mon'),
    t('date.day_tue'),
    t('date.day_wed'),
    t('date.day_thu'),
    t('date.day_fri'),
    t('date.day_sat'),
  ];
  const offset = viewType === 'weekly' ? 7 : 1;
  const label =
    viewType === 'weekly' ? formatWeeklyLabel(dateKey) : formatDailyLabel(dateKey, days);
  return (
    <div
      {...verifyAttrs({ unit: 'BoardDateNav', viewType, dateKey, label })}
      className="absolute left-6 top-5 z-10 flex items-center gap-3"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      <button
        type="button"
        onClick={() => onDateChange(shiftDate(dateKey, -offset))}
        data-verify-nav="prev"
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
        data-verify-nav="next"
        className="flex h-6 w-6 items-center justify-center rounded text-sm transition-colors"
        style={{ color: 'var(--date-color)' }}
      >
        ›
      </button>

      {/* 表示単位のセグメント切り替え */}
      <div
        className="ml-1 flex items-center gap-0.5 rounded-lg border p-0.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {VIEW_TYPES.map((v) => {
          const isActive = viewType === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewTypeChange(v.id)}
              aria-pressed={isActive}
              data-verify-view-option={v.id}
              className="rounded-md px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.15em] transition-colors"
              style={
                isActive
                  ? { backgroundColor: 'var(--accent)', color: '#fff' }
                  : { backgroundColor: 'transparent', color: 'var(--date-color)' }
              }
            >
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
