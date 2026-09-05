'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeEntry } from '@/features/shared/entries/normalize';
import type { EntryListItem, EntryListOrder } from '@/features/shared/entries/types';
import type { ApiClient } from '@/lib/api';

const PAGE_SIZE = 20;

export function useEntries(
  api: ApiClient | null,
  search?: string,
  questionId?: string,
  order: EntryListOrder = 'newest',
) {
  const [entries, setEntries] = useState<EntryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Issue #357: 取得失敗を握りつぶさず error ステートとして surface する（UI が ErrorState を出せる）。
  const [error, setError] = useState<boolean>(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const prevSearchRef = useRef(search);
  const prevQuestionIdRef = useRef(questionId);
  const prevOrderRef = useRef(order);

  const fetchEntries = useCallback(
    async (nextCursor?: string) => {
      if (!api) return;
      setLoading(true);
      setError(false);

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (nextCursor) params.set('cursor', nextCursor);
        if (search) params.set('q', search);
        if (questionId) params.set('questionId', questionId);
        params.set('order', order);

        const res = await api.fetch(`/api/v1/entries?${params}`);

        if (res.ok) {
          const data = await res.json();
          const items: EntryListItem[] = (Array.isArray(data) ? data : []).map(normalizeEntry);
          setEntries((prev) => (nextCursor ? [...prev, ...items] : items));
          setHasMore(items.length === PAGE_SIZE);
          if (items.length > 0) {
            // カーソルはサーバーの created_at 比較（.lt/.gt）に合わせて作成日時を渡す。
            // id を渡すと比較対象がずれて load-more が壊れる（過去バグ）。
            setCursor(items[items.length - 1].createdAt);
          }
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      }

      setLoading(false);
    },
    [api, search, questionId, order],
  );

  useEffect(() => {
    // Issue #331: 検索キーワード・問いフィルタ・ソート順のいずれかが切り替わったら
    // カーソルとリストをリセットして先頭から取り直す。
    if (
      prevSearchRef.current !== search ||
      prevQuestionIdRef.current !== questionId ||
      prevOrderRef.current !== order
    ) {
      prevSearchRef.current = search;
      prevQuestionIdRef.current = questionId;
      prevOrderRef.current = order;
      setEntries([]);
      setCursor(undefined);
      setHasMore(true);
    }
  }, [search, questionId, order]);

  // Issue #362: auth/me 完了を待たず、api が用意でき次第すぐ取得する（体感ロード短縮）。
  useEffect(() => {
    if (api) {
      fetchEntries();
    }
  }, [api, fetchEntries]);

  const loadMore = useCallback(() => {
    fetchEntries(cursor);
  }, [fetchEntries, cursor]);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const retry = useCallback(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, error, hasMore, loadMore, removeEntry, retry };
}
