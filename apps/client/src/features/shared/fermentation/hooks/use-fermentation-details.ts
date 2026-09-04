'use client';

import { useEffect, useRef, useState } from 'react';
import { normalizeDetail } from '@/features/shared/fermentation/normalize';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

interface UseFermentationDetailsResult {
  /** 取得済みの詳細（id → 詳細）。未取得・未完了の id はキーを持たない。 */
  details: ReadonlyMap<string, FermentationDetail>;
  /** いま 1 件でも取得中か。 */
  loading: boolean;
}

const EMPTY: ReadonlyMap<string, FermentationDetail> = new Map();

/**
 * 複数の発酵詳細を id 指定でまとめて取得し、**id でキャッシュする**（端末非依存）。
 *
 * 発酵履歴（Cover Flow）は正面と左右 1 枚だけ中身が要る。全件を先に取ると、履歴が
 * 伸びた人ほど開くのが重くなる（週次なら 1 年で 50 本超）。呼び出し側が「いま要る id」
 * だけを渡し、ここが未取得ぶんだけを並行で取る。一度取った詳細はキャッシュに残るので、
 * めくって戻ったときの再取得は起きない。
 *
 * `useFermentationDetail`（1 件・id が変わるたび取得）とは役割が違うので別に置く。
 * あちらは「開いた手紙 1 通」、こちらは「めくりながら見る窓」。
 */
export function useFermentationDetails(
  api: ApiClient | null,
  ids: readonly string[],
): UseFermentationDetailsResult {
  const [details, setDetails] = useState<ReadonlyMap<string, FermentationDetail>>(EMPTY);
  const [pending, setPending] = useState(0);

  /**
   * 取りに行った id。取れなかった id も残す（毎レンダー取りに行かないため）。
   * state ではなく ref なのは、書いた瞬間に次の効果へ効いてほしいから。
   */
  const requested = useRef(new Set<string>());

  /** 直前の api。差し替わったらキャッシュは別人のものになりうるので捨てる。 */
  const lastApi = useRef(api);

  // ids は呼び出し側が毎レンダー新しい配列を作るので、中身を文字列に畳んで依存にする。
  const key = ids.join(',');

  useEffect(() => {
    if (!api) return;
    const client = api;
    if (lastApi.current !== api) {
      lastApi.current = api;
      requested.current = new Set();
      setDetails(EMPTY);
    }
    const missing = key.split(',').filter((id) => id !== '' && !requested.current.has(id));
    if (missing.length === 0) return;
    for (const id of missing) requested.current.add(id);

    let cancelled = false;
    setPending((n) => n + missing.length);

    Promise.all(
      missing.map(async (id) => {
        try {
          const res = await client.fetch(`/api/v1/fermentations/${id}`);
          if (!res.ok) return null;
          const normalized = normalizeDetail(await res.json());
          // 完了済みの詳細だけを見せる（途中経過は円盤にも詳細パネルにも出さない）。
          return normalized?.status === 'completed' ? normalized : null;
        } catch {
          // 1 件落ちても他の円盤は出せる。
          return null;
        }
      }),
    ).then((loaded) => {
      // 取得中の数は cancel でも必ず戻す。ここを早期 return にすると、
      // 依存が変わって張り直されたときに loading が true のまま残る。
      setPending((n) => Math.max(0, n - missing.length));
      if (cancelled) return;
      const found = loaded.filter((d): d is FermentationDetail => d !== null);
      if (found.length === 0) return;
      setDetails((prev) => {
        const next = new Map(prev);
        for (const d of found) next.set(d.id, d);
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [api, key]);

  return { details, loading: pending > 0 };
}
