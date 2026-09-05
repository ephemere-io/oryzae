'use client';

import { useEffect, useMemo, useState } from 'react';
import { normalizeDetail } from '@/features/shared/fermentation/normalize';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

/**
 * 複数の発酵の詳細をまとめて引く（端末非依存）。
 *
 * 受信箱（use-fermentation-inbox）が問いごとに最新 1 通へ畳んでくれるので、その全部を
 * ここへ渡す。問いは生存が最大 3 件なので往復も 3 回に収まる。
 *
 * 1 件でも失敗したら残りだけを返す。中身は瓶の見た目であって、取れないならその問いの
 * 円が空に見えるだけで済ませる（書斎・瓶は部分的な失敗で落とさない）。
 *
 * **`loading` は effect ではなく描画中に決める。** 「いま持っている詳細が、いまの発酵の分か」
 * を鍵の一致で見る。effect が走ってから loading を立てる作りだと、一覧が届いた直後の
 * 1 フレームだけ「取得済み・中身ゼロ」になり、そこで画面が組み直されて中身が消える。
 */
export function useFermentationDetails(
  api: ApiClient | null,
  fermentationIds: readonly string[],
): { details: Map<string, FermentationDetail>; loading: boolean } {
  const [loaded, setLoaded] = useState<{ key: string; details: Map<string, FermentationDetail> }>({
    key: '',
    details: new Map(),
  });

  // 配列は毎レンダー新しい参照になる。中身が同じ限り取り直さないよう鍵に畳む。
  const key = useMemo(() => [...fermentationIds].sort().join(','), [fermentationIds]);

  useEffect(() => {
    const ids = key.length > 0 ? key.split(',') : [];
    if (!api || ids.length === 0) {
      setLoaded({ key, details: new Map() });
      return;
    }

    const client = api;
    let cancelled = false;

    Promise.all(
      ids.map(async (id): Promise<FermentationDetail | null> => {
        try {
          const res = await client.fetch(`/api/v1/fermentations/${id}`);
          if (!res.ok) return null;
          // 形が違えば null。その発酵の中身が出ないだけで、他は出る。
          return normalizeDetail(await res.json());
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const details = new Map<string, FermentationDetail>();
      for (const detail of results) {
        if (detail) details.set(detail.id, detail);
      }
      setLoaded({ key, details });
    });

    return () => {
      cancelled = true;
    };
  }, [api, key]);

  // 取り直している間も**前の中身を返す**。空に落とすと、その間だけ円が空になる。
  return { details: loaded.details, loading: loaded.key !== key };
}
