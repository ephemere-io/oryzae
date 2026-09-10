'use client';

import { useEffect, useState } from 'react';
import { normalizeBoardCards } from '@/features/shared/board/normalize';
import type { BoardSummary } from '@/features/shared/board/types';
import type { ApiClient } from '@/lib/api';
import { isObject, readJson } from '@/lib/json';

const EMPTY: BoardSummary = { total: 0, snippets: 0, photos: 0, cards: [] };

/** 数として読めなければ 0。書斎は部分的な欠けで落とさない。 */
function readCount(value: unknown): number {
  return typeof value === 'number' && value >= 0 ? value : 0;
}

/**
 * 書斎の壁が読む「いま貼ってあるもの」（`GET /api/v1/board/summary`）。
 *
 * **盤面（`use-board`）とは別の口を叩く。** あちらは 1 日・1 週の作業場で、日付と
 * view で絞る。書斎の壁は溜まってきた量そのものを映すので絞らない — 当日の daily だけを
 * 映していたころは、その日に何も貼っていなければ壁が空で、**使っている人の壁ほど
 * 空に見える**という逆の絵になっていた。
 *
 * 取れなければ空で出す。書斎は部分的な失敗で落とさない（10-data-contract.md）。
 */
export function useBoardSummary(
  api: ApiClient | null,
  authLoading: boolean,
): { summary: BoardSummary; loading: boolean; error: boolean } {
  const [summary, setSummary] = useState<BoardSummary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!api || authLoading) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.fetch('/api/v1/board/summary');
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          return;
        }
        const body = await readJson(res);
        if (cancelled) return;
        const raw = isObject(body) ? body : {};
        setSummary({
          total: readCount(raw.total),
          snippets: readCount(raw.snippets),
          photos: readCount(raw.photos),
          cards: normalizeBoardCards(raw.cards),
        });
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, authLoading]);

  return { summary, loading, error };
}
