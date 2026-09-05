'use client';

import { useEffect, useState } from 'react';
import type { MonthlyEntryCount } from '@/features/shared/entries/types';
import type { ApiClient } from '@/lib/api';
import { isObject, readJson } from '@/lib/json';

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function normalizeCounts(raw: unknown): MonthlyEntryCount[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row): MonthlyEntryCount[] => {
    if (!isObject(row)) return [];
    const { month, count } = row;
    // 月の形が違う行は捨てる。手帳の背文字と積みの順序がそのまま壊れるため。
    if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) return [];
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return [];
    return [{ month, count: Math.floor(count) }];
  });
}

/**
 * 月ごとの記録件数（`GET /api/v1/entries/monthly-counts`）。手帳の厚みと棚の冊数を決める。
 *
 * 「月」は利用者のローカル暦月なので、`getTimezoneOffset()` をそのまま送る。これが無いと
 * JST の月初 00:00〜09:00 に書いた記録が前月の冊に落ちる。
 *
 * 取れなければ空配列を返す。机は当月の空の手帳 1 冊だけになるが、書斎は出る
 * （10-data-contract.md「失敗時の扱い」）。
 */
export function useEntryMonthlyCounts(
  api: ApiClient | null,
  authLoading: boolean,
): { counts: MonthlyEntryCount[]; loading: boolean; error: boolean } {
  const [counts, setCounts] = useState<MonthlyEntryCount[]>([]);
  const [loading, setLoading] = useState(true);
  // 取れなかったのか、本当に 1 件も無いのか。呼び出し側が見分けられるようにする。
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!api || authLoading) return;
    let cancelled = false;

    async function load(client: ApiClient): Promise<void> {
      try {
        const tzOffset = new Date().getTimezoneOffset();
        const res = await client.fetch(`/api/v1/entries/monthly-counts?tzOffset=${tzOffset}`);
        if (cancelled) return;
        if (res.ok) setCounts(normalizeCounts(await readJson(res)));
        else setError(true);
      } catch {
        // 机が空になるだけ。書斎そのものは壊さない。
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load(api);
    return () => {
      cancelled = true;
    };
  }, [api, authLoading]);

  return { counts, loading, error };
}
