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
 *
 * **`loading` は effect ではなく描画中に決める。** 「いま持っている言葉が、いまの発酵の分か」
 * を鍵の一致で見る。effect が走ってから loading を立てる作りだと、発酵の一覧が届いた
 * 直後の 1 フレームだけ「取得済み・言葉ゼロ」になり、そこで書斎が組み直されて
 * **浮かんでいた言葉がいったん消える**（実機で「言葉が出た後に消えて、また出る」として出ていた）。
 */
export function useFermentationKeywords(
  api: ApiClient | null,
  fermentationIds: readonly string[],
): { keywords: string[]; loading: boolean } {
  /** どの鍵に対する結果を持っているか。鍵が違えば、それは前の発酵の言葉。 */
  const [loaded, setLoaded] = useState<{ key: string; keywords: string[] }>({
    key: '',
    keywords: [],
  });

  // 配列は毎レンダー新しい参照になる。中身が同じ限り取り直さないよう鍵に畳む。
  const key = useMemo(() => [...fermentationIds].sort().join(','), [fermentationIds]);

  useEffect(() => {
    const ids = key.length > 0 ? key.split(',') : [];
    if (!api || ids.length === 0) {
      setLoaded({ key, keywords: [] });
      return;
    }

    const client = api;
    let cancelled = false;

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
      setLoaded({
        key,
        keywords: [...new Set(perFermentation.flat())].filter((word) => word.length > 0),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [api, key]);

  // 取り直している間も**前の言葉を返す**。空に落とすと、その間だけ瓶が空になる。
  return { keywords: loaded.keywords, loading: loaded.key !== key };
}
