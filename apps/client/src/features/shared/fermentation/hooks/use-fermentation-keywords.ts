'use client';

import { useEffect, useMemo, useState } from 'react';
import { normalizeDetail } from '@/features/shared/fermentation/normalize';
import type { ApiClient } from '@/lib/api';

/**
 * 複数の発酵から言葉（キーワード）をまとめて集める。
 *
 * 書斎の瓶に浮かべるのは「**問いごとの最新のキーワード**」。受信箱（use-fermentation-inbox）が
 * 問いごとに最新 1 通へ畳んでくれるので、その全部の詳細を引けばよい。問いは生存が
 * 最大 3 件なので、往復も 3 回に収まる。
 *
 * 1 件でも失敗したら残りだけを返す。言葉は瓶の見た目であって、取れないなら
 * その語が浮かばないだけで済ませる（書斎は部分的な失敗で落とさない）。
 */
export function useFermentationKeywords(
  api: ApiClient | null,
  fermentationIds: readonly string[],
): { keywords: string[]; loading: boolean } {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 配列は毎レンダー新しい参照になる。中身が同じ限り取り直さないよう鍵に畳む。
  const key = useMemo(() => [...fermentationIds].sort().join(','), [fermentationIds]);

  useEffect(() => {
    const ids = key.length > 0 ? key.split(',') : [];
    if (!api || ids.length === 0) {
      setKeywords([]);
      return;
    }

    const client = api;
    let cancelled = false;
    setLoading(true);

    Promise.all(
      ids.map(async (id) => {
        try {
          const res = await client.fetch(`/api/v1/fermentations/${id}`);
          if (!res.ok) return [];
          // 形が違えば null。その発酵の言葉が出ないだけで、他は出る。
          const detail = normalizeDetail(await res.json());
          return detail ? detail.keywords.map((keyword) => keyword.keyword) : [];
        } catch {
          return [];
        }
      }),
    ).then((perFermentation) => {
      if (cancelled) return;
      // 同じ言葉が別の問いから出ることがある。瓶の中で二重に浮かべない。
      setKeywords([...new Set(perFermentation.flat())].filter((word) => word.length > 0));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [api, key]);

  return { keywords, loading };
}
