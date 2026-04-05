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
    return <p className="text-sm text-zinc-500">読み込み中...</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        まだエントリがありません。最初のエントリを書いてみましょう。
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
          className="self-center rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {loading ? '読み込み中...' : 'もっと見る'}
        </button>
      )}
    </div>
  );
}
