'use client';

import { useEntries } from '@/features/entries/hooks/use-entries';
import type { ApiClient } from '@/lib/api';
import { EntryCard } from './entry-card';

interface EntryListProps {
  api: ApiClient | null;
  authLoading: boolean;
}

interface EntryItem {
  id: string;
  content: string;
  createdAt: string;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

interface MonthGroup {
  label: string;
  weeks: WeekGroup[];
}

interface WeekGroup {
  label: string;
  entries: EntryItem[];
}

function groupEntries(entries: EntryItem[]): MonthGroup[] {
  const months = new Map<string, Map<number, EntryItem[]>>();

  for (const entry of entries) {
    const d = new Date(entry.createdAt);
    const monthKey = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    const weekNum = getISOWeekNumber(d);

    if (!months.has(monthKey)) {
      months.set(monthKey, new Map());
    }
    const weekMap = months.get(monthKey);
    if (weekMap) {
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, []);
      }
      weekMap.get(weekNum)?.push(entry);
    }
  }

  const result: MonthGroup[] = [];
  for (const [monthLabel, weekMap] of months) {
    const weeks: WeekGroup[] = [];
    for (const [weekNum, items] of weekMap) {
      weeks.push({ label: `第${weekNum}週`, entries: items });
    }
    result.push({ label: monthLabel, weeks });
  }
  return result;
}

export function EntryList({ api, authLoading }: EntryListProps) {
  const { entries, loading, hasMore, loadMore } = useEntries(api, authLoading);

  if (authLoading || (loading && entries.length === 0)) {
    return <p className="text-center text-sm text-[var(--date-color)]">読み込み中...</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--date-color)]">
        エントリーはまだありません
      </p>
    );
  }

  const monthGroups = groupEntries(entries);

  return (
    <div className="flex flex-col">
      {monthGroups.map((month) => (
        <div key={month.label}>
          {/* Month header */}
          <div className="border-b border-[var(--border-subtle)] pb-2 pt-6 text-sm font-medium text-[var(--fg)]">
            {month.label}
          </div>

          {month.weeks.map((week) => (
            <div key={week.label}>
              {/* Week label */}
              <div className="pt-4 pb-2 text-xs text-[var(--date-color)]">{week.label}</div>

              {week.entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  id={entry.id}
                  content={entry.content}
                  createdAt={entry.createdAt}
                />
              ))}
            </div>
          ))}
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-6 self-center rounded-full border border-[var(--border-subtle)] px-5 py-1.5 text-sm text-[var(--date-color)] transition-colors hover:bg-[rgba(200,180,140,0.06)] disabled:opacity-50"
        >
          {loading ? '読み込み中...' : 'もっと見る'}
        </button>
      )}
    </div>
  );
}
