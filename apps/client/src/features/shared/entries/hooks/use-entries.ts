'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeEntries } from '@/features/shared/entries/normalize';
import type { EntryListItem, EntryListOrder } from '@/features/shared/entries/types';
import type { ApiClient } from '@/lib/api';

const PAGE_SIZE = 20;

/**
 * 記録の一覧。検索・問い・並び順・**月**で絞れる。
 *
 * 月の絞りはサーバーが利用者のローカル暦月で行う（`?month=YYYY-MM&tzOffset=`）。
 * 手元で `createdAt` を切って絞ると **UTC の月**での判定になり、月初 00:00〜09:00 に
 * 書いた記録を前月扱いで落とす。書斎の一覧がまさにそれで空になっていた。
 */
export function useEntries(
  api: ApiClient | null,
  search?: string,
  questionId?: string,
  order: EntryListOrder = 'newest',
  month?: string,
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
  const prevMonthRef = useRef(month);
  // 検索・並び替えを素早く切り替えると複数の fetch が並行して飛ぶ。応答が要求順と
  // 前後すると、古い応答が新しい検索結果を上書きしてしまう（use-board.ts と同じ対策）。
  const requestIdRef = useRef(0);

  const fetchEntries = useCallback(
    async (nextCursor?: string) => {
      if (!api) return;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(false);

      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (nextCursor) params.set('cursor', nextCursor);
        if (search) params.set('q', search);
        if (questionId) params.set('questionId', questionId);
        if (month) {
          params.set('month', month);
          // 件数（monthly-counts）と同じ月の切り方にするために必ず送る。
          params.set('tzOffset', String(new Date().getTimezoneOffset()));
        }
        params.set('order', order);

        const res = await api.fetch(`/api/v1/entries?${params}`);
        if (requestId !== requestIdRef.current) return;

        if (res.ok) {
          const data = await res.json();
          // json() を待っている間に新しい要求が出ていることがある。ここでもう一度見る。
          if (requestId !== requestIdRef.current) return;
          const items: EntryListItem[] = normalizeEntries(data);
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
        if (requestId === requestIdRef.current) setError(true);
      }

      if (requestId === requestIdRef.current) setLoading(false);
    },
    [api, search, questionId, order, month],
  );

  useEffect(() => {
    // Issue #331: 検索キーワード・問いフィルタ・ソート順のいずれかが切り替わったら
    // カーソルとリストをリセットして先頭から取り直す。
    if (
      prevSearchRef.current !== search ||
      prevQuestionIdRef.current !== questionId ||
      prevOrderRef.current !== order ||
      prevMonthRef.current !== month
    ) {
      prevSearchRef.current = search;
      prevQuestionIdRef.current = questionId;
      prevOrderRef.current = order;
      prevMonthRef.current = month;
      setEntries([]);
      setCursor(undefined);
      setHasMore(true);
    }
  }, [search, questionId, order, month]);

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
