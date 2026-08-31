'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntryListOrder } from '@/features/shared/entries/types';
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

export function useEntries(
  api: ApiClient | null,
  search?: string,
  questionId?: string,
  order: EntryListOrder = 'newest',
) {
  const [entries, setEntries] = useState<Entry[]>([]);
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
          const items: Entry[] = (Array.isArray(data) ? data : []).map(normalizeEntry);
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
