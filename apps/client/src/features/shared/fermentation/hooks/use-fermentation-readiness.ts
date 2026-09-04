'use client';

import { useEffect, useState } from 'react';
import type { FermentationReadiness } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';
import { isObject, readJson } from '@/lib/json';

/** 取得できなかったときの見た目＝「まだ何も起きていない瓶」。 */
const IDLE: FermentationReadiness = { readiness: 0, eligible: false, nextRunAt: null };

function normalizeReadiness(raw: unknown): FermentationReadiness {
  if (!isObject(raw)) return IDLE;
  const { readiness, eligible, nextRunAt } = raw;
  // 0..1 の外や NaN は「まだ何もない」に倒す。液面や泡の数がそのまま壊れるため。
  const value =
    typeof readiness === 'number' && Number.isFinite(readiness)
      ? Math.min(1, Math.max(0, readiness))
      : 0;
  return {
    readiness: value,
    eligible: eligible === true,
    nextRunAt: typeof nextRunAt === 'string' ? nextRunAt : null,
  };
}

/**
 * 書斎の瓶が読む進み具合。
 *
 * 取れなければ `idle` の見た目（泡 4 つ・液面最小）で出す。書斎は部分的な失敗で
 * 落とさない（10-data-contract.md「失敗時の扱い」）。
 */
export function useFermentationReadiness(
  api: ApiClient | null,
  authLoading: boolean,
): { readiness: FermentationReadiness; loading: boolean } {
  const [readiness, setReadiness] = useState<FermentationReadiness>(IDLE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api || authLoading) return;
    let cancelled = false;

    async function load(client: ApiClient): Promise<void> {
      try {
        const res = await client.fetch('/api/v1/fermentations/readiness');
        if (cancelled) return;
        if (res.ok) setReadiness(normalizeReadiness(await readJson(res)));
      } catch {
        // 瓶は idle の見た目で出る。書斎そのものは壊さない。
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load(api);
    return () => {
      cancelled = true;
    };
  }, [api, authLoading]);

  return { readiness, loading };
}
