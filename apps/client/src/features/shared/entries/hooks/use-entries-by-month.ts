'use client';

import { useEffect, useState } from 'react';
import { normalizeEntries } from '@/features/shared/entries/normalize';
import type { EntryListItem } from '@/features/shared/entries/types';
import type { ApiClient } from '@/lib/api';

/**
 * ある月に書かれた記録を**その月ぶん全部**取る（`GET /api/v1/entries?month=YYYY-MM`）。
 *
 * 書斎の一覧が使う。以前は「直近 20 件を月で絞る」だけだったので、20 件より古い月を
 * 選ぶと必ず「この月の記録はありません」になっていた（手帳の厚みは 14 件と言うのに
 * 一覧は 0 件、という食い違いが出る）。絞り込みはサーバーに任せる。
 *
 * **サーバーと同じ月の切り方にする。** `tzOffset` を送らないと、JST の月初 00:00〜09:00 に
 * 書いた記録が前月に落ちて、件数（monthly-counts）とまた食い違う。
 */

/** 1 往復で取る件数。ふつうの月はこれ 1 回で終わる。 */
const PAGE_SIZE = 100;

/** 辿るページ数の上限。1 ヶ月に 1000 件書く人は想定しない（保険）。 */
const MAX_PAGES = 10;

export function useEntriesByMonth(
  api: ApiClient | null,
  month: string | null,
): { entries: EntryListItem[]; loading: boolean; error: boolean } {
  /** どの月の結果を持っているか。月が変われば、それは前の月の記録。 */
  const [loaded, setLoaded] = useState<{ month: string | null; entries: EntryListItem[] }>({
    month: null,
    entries: [],
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!api || month === null) return;

    const client = api;
    let cancelled = false;
    setError(false);

    async function load(): Promise<void> {
      const collected: EntryListItem[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < MAX_PAGES; page++) {
        const params = new URLSearchParams({
          month: String(month),
          tzOffset: String(new Date().getTimezoneOffset()),
          limit: String(PAGE_SIZE),
          order: 'newest',
        });
        if (cursor) params.set('cursor', cursor);

        const res = await client.fetch(`/api/v1/entries?${params}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          return;
        }

        const items = normalizeEntries(await res.json());
        collected.push(...items);
        // 満たなければそれで終わり。ちょうど届いたときだけ次を見に行く。
        if (items.length < PAGE_SIZE) break;
        cursor = items[items.length - 1]?.createdAt;
        if (!cursor) break;
      }

      if (!cancelled) setLoaded({ month, entries: collected });
    }

    load().catch(() => {
      // 取れなくても書斎は落とさない。一覧が「読み込み中」から「0 件」に変わるだけ。
      if (!cancelled) setError(true);
    });

    return () => {
      cancelled = true;
    };
  }, [api, month]);

  // 別の月を取りに行っている間に前の月の記録を出さない。`loading` は描画中に決める
  // （effect が走るのを待つと、月を切り替えた 1 フレームだけ前の月が見える）。
  const ready = loaded.month === month;
  return {
    entries: ready ? loaded.entries : [],
    loading: month !== null && !ready && !error,
    error,
  };
}
