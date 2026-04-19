'use client';

import { useCallback, useState } from 'react';
import { useDebounce } from '@/features/entries/hooks/use-debounce';
import { useDeleteEntry } from '@/features/entries/hooks/use-delete-entry';
import { useEntries } from '@/features/entries/hooks/use-entries';
import type { ApiClient } from '@/lib/api';
import { DeleteConfirmModal } from './delete-confirm-modal';
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
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const search = debouncedSearch.trim() || undefined;
  const { entries, loading, hasMore, loadMore, removeEntry } = useEntries(api, authLoading, search);
  const { deleteEntry, deleting } = useDeleteEntry(api);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isSearching = !!search;

  const handleDeleteClick = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    if (deleting) return;
    setPendingDeleteId(null);
  }, [deleting]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteId) return;
    const ok = await deleteEntry(pendingDeleteId);
    if (ok) {
      removeEntry(pendingDeleteId);
      setPendingDeleteId(null);
    }
  }, [deleteEntry, pendingDeleteId, removeEntry]);

  return (
    <div className="flex flex-col">
      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="エントリーを検索..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] px-4 py-2.5 pl-10 text-sm text-[var(--fg)] placeholder:text-[var(--date-color)] focus:border-[var(--accent)] focus:outline-none"
        />
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--date-color)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-label="検索"
          role="img"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--date-color)] hover:text-[var(--fg)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="検索をクリア"
              role="img"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {authLoading || (loading && entries.length === 0) ? null : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--date-color)]">
          {isSearching ? '検索結果はありません' : 'エントリーはまだありません'}
        </p>
      ) : isSearching ? (
        /* Flat list for search results (no month/week grouping) */
        <div className="flex flex-col">
          <div className="pb-2 text-xs text-[var(--date-color)]">{entries.length}件の結果</div>
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              id={entry.id}
              content={entry.content}
              createdAt={entry.createdAt}
              searchQuery={search}
              onDeleteClick={handleDeleteClick}
            />
          ))}
        </div>
      ) : (
        /* Grouped list for normal browsing */
        groupEntries(entries).map((month) => (
          <div key={month.label}>
            <div className="border-b border-[var(--border-subtle)] pb-2 pt-6 text-sm font-medium text-[var(--fg)]">
              {month.label}
            </div>

            {month.weeks.map((week) => (
              <div key={week.label}>
                <div className="pt-4 pb-2 text-xs text-[var(--date-color)]">{week.label}</div>

                {week.entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    id={entry.id}
                    content={entry.content}
                    createdAt={entry.createdAt}
                    onDeleteClick={handleDeleteClick}
                  />
                ))}
              </div>
            ))}
          </div>
        ))
      )}

      {hasMore && entries.length > 0 && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-6 self-center rounded-full border border-[var(--border-subtle)] px-5 py-1.5 text-sm text-[var(--date-color)] transition-colors hover:bg-[rgba(200,180,140,0.06)] disabled:opacity-50"
        >
          {loading ? '読み込み中...' : 'もっと見る'}
        </button>
      )}

      <DeleteConfirmModal
        open={pendingDeleteId !== null}
        deleting={deleting}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
