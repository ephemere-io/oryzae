'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface Entry {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
}

const PAGE_SIZE = 20;

export function useEntries(api: ApiClient | null, authLoading: boolean, search?: string) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const prevSearchRef = useRef(search);

  const fetchEntries = useCallback(
    async (nextCursor?: string) => {
      if (!api) return;
      setLoading(true);

      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (nextCursor) params.set('cursor', nextCursor);
      if (search) params.set('q', search);

      const res = await api.fetch(`/api/v1/entries?${params}`);

      if (res.ok) {
        const data = await res.json();
        const items: Entry[] = Array.isArray(data) ? data : [];
        setEntries((prev) => (nextCursor ? [...prev, ...items] : items));
        setHasMore(items.length === PAGE_SIZE);
        if (items.length > 0) {
          setCursor(items[items.length - 1].id);
        }
      }

      setLoading(false);
    },
    [api, search],
  );

  useEffect(() => {
    if (prevSearchRef.current !== search) {
      prevSearchRef.current = search;
      setEntries([]);
      setCursor(undefined);
      setHasMore(true);
    }
  }, [search]);

  useEffect(() => {
    if (!authLoading && api) {
      fetchEntries();
    }
  }, [authLoading, api, fetchEntries]);

  const loadMore = useCallback(() => {
    fetchEntries(cursor);
  }, [fetchEntries, cursor]);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { entries, loading, hasMore, loadMore, removeEntry };
}
