'use client';

import { useEntries } from '@/features/entries/hooks/use-entries';
import type { ApiClient } from '@/lib/api';
import { EntryCard } from './entry-card';

interface EntryListProps {
  api: ApiClient | null;
  authLoading: boolean;
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

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          id={entry.id}
          content={entry.content}
          createdAt={entry.createdAt}
        />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="self-center rounded-full border border-[var(--border-subtle)] px-5 py-1.5 text-sm text-[var(--date-color)] transition-colors hover:bg-[rgba(200,180,140,0.06)] disabled:opacity-50"
        >
          {loading ? '読み込み中...' : 'もっと見る'}
        </button>
      )}
    </div>
  );
}
