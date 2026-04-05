'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { EntryCard } from './entry-card';

interface Entry {
  id: string;
  content: string;
  createdAt: string;
}

export function EntryList() {
  const { api, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const fetchEntries = useCallback(
    async (nextCursor?: string) => {
      if (!api) return;
      setLoading(true);

      const query: Record<string, string> = { limit: '20' };
      if (nextCursor) query.cursor = nextCursor;

      const res = await api.api.v1.entries.$get({ query });

      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : ((data as { entries: Entry[] }).entries ?? []);
        setEntries((prev) => (nextCursor ? [...prev, ...items] : items));
        setHasMore(items.length === 20);
        if (items.length > 0) {
          setCursor(items[items.length - 1].id);
        }
      }

      setLoading(false);
    },
    [api],
  );

  useEffect(() => {
    if (!authLoading && api) {
      fetchEntries();
    }
  }, [authLoading, api, fetchEntries]);

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
          onClick={() => fetchEntries(cursor)}
          disabled={loading}
          className="self-center rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {loading ? '読み込み中...' : 'もっと見る'}
        </button>
      )}
    </div>
  );
}
