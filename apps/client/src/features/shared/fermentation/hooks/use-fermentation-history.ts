'use client';

import { useEffect, useMemo, useState } from 'react';
import { normalizeSummaries } from '@/features/shared/fermentation/normalize';
import type { FermentationSummary } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

interface UseFermentationHistoryResult {
  /**
   * 問い ID → その問いの完了済み発酵（**古い順**、末尾が最新）。
   * 発酵が 0 件の問いはキー自体を持たない。
   */
  byQuestion: ReadonlyMap<string, FermentationSummary[]>;
  loading: boolean;
}

const EMPTY: ReadonlyMap<string, FermentationSummary[]> = new Map();

function byCreatedAtAsc(a: FermentationSummary, b: FermentationSummary): number {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/**
 * ユーザーの完了済み発酵を問いごとに古い順で束ねる（端末非依存）。
 *
 * 発酵履歴（Cover Flow）は「1 問い＝発酵の配列」を必要とするが、問いごとに
 * `?questionId=` を叩くと問いの数だけリクエストが出る。一覧 API は questionId 省略で
 * ユーザーの全発酵を 1 回で返す（Issue #363 で入った経路）ので、こちらを使って
 * クライアント側で束ねる。瓶の円 3 つぶんのメタラベルも同じ 1 回で賄える。
 *
 * 本文（言葉・抜粋・手紙）はここでは取らない。1 件ぶんでも重く、履歴が伸びるほど
 * 効いてくるので、正面に出る発酵の詳細だけを useFermentationDetails が別に取る。
 */
export function useFermentationHistory(
  api: ApiClient | null,
  authLoading: boolean,
): UseFermentationHistoryResult {
  const [summaries, setSummaries] = useState<FermentationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api || authLoading) return;
    const client = api;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await client.fetch('/api/v1/fermentations');
        if (cancelled || !res.ok) return;
        const data: unknown = await res.json();
        if (cancelled) return;
        // normalizeSummaries が要素ごとに形を確かめる。配列でないレスポンス
        // （エラーエンベロープ等）で TypeError にならないのが要点。
        setSummaries(normalizeSummaries(data).filter((s) => s.status === 'completed'));
      } catch {
        // 履歴が取れなくても瓶自体は成立する（ラベルが出ないだけ）。
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [api, authLoading]);

  const byQuestion = useMemo(() => {
    if (summaries.length === 0) return EMPTY;
    const map = new Map<string, FermentationSummary[]>();
    for (const s of summaries) {
      const list = map.get(s.questionId);
      if (list) list.push(s);
      else map.set(s.questionId, [s]);
    }
    // API は created_at 降順で返すが、順序は API の都合なので当てにしない。
    for (const list of map.values()) list.sort(byCreatedAtAsc);
    return map;
  }, [summaries]);

  return { byQuestion, loading };
}
