'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface LinkedQuestionSummary {
  id: string;
  currentText: string | null;
}

interface Entry {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  /** Issue #323: 一覧に紐づく問いを表示するためサーバーが埋め込んで返す */
  linkedQuestions: LinkedQuestionSummary[];
}

const PAGE_SIZE = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * Issue #323: サーバーは linkedQuestions を必ず配列で返すが、未デプロイ時や
 * テストモックの取りこぼしを許容してフォールバックしておく。
 */
function normalizeEntry(raw: unknown): Entry {
  const r = isRecord(raw) ? raw : {};
  const rawLinked = Array.isArray(r.linkedQuestions) ? r.linkedQuestions : [];
  const linkedQuestions: LinkedQuestionSummary[] = rawLinked.filter(isRecord).map((q) => ({
    id: String(q.id ?? ''),
    currentText: typeof q.currentText === 'string' ? q.currentText : null,
  }));
  return {
    id: String(r.id ?? ''),
    userId: String(r.userId ?? ''),
    content: typeof r.content === 'string' ? r.content : '',
    mediaUrls: Array.isArray(r.mediaUrls) ? r.mediaUrls.map((u) => String(u)) : [],
    createdAt: String(r.createdAt ?? ''),
    updatedAt: String(r.updatedAt ?? ''),
    linkedQuestions,
  };
}

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
        const items: Entry[] = (Array.isArray(data) ? data : []).map(normalizeEntry);
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
