'use client';

import { useCallback, useEffect, useState } from 'react';
import { normalizeReadiness } from '@/features/shared/fermentation/normalize';
import type { FermentationReadiness } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

interface UseFermentationReadinessResult {
  readiness: FermentationReadiness | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * 発酵瓶アニメーション用に「ユーザーが現在どこまで発酵に近いか」を取得する（Issue #278）。
 *
 * 合計 readiness の解釈（値そのものは UI に数値として出さない）:
 *   - 1.0 = 1 問が発火直前 → 瓶は「かなり熟成」
 *   - 2.0 = 複数問が活性化 → 微生物の動きが活発
 *   - 3.0 = 全 3 問が発火寸前 → ぶくぶく激しく泡立つ
 *
 * 演出は今のところ PC の瓶だけだが、fetch は端末非依存なので shared に置く
 * （Issue #490: pc に置くと SP 追加時に必ずコピーが生まれる）。
 */
export function useFermentationReadiness(
  api: ApiClient | null,
  authLoading: boolean,
): UseFermentationReadinessResult {
  const [readiness, setReadiness] = useState<FermentationReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReadiness = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    const res = await api.fetch('/api/v1/fermentations/readiness');
    if (res.ok) {
      const normalized = normalizeReadiness(await res.json());
      if (normalized) setReadiness(normalized);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (authLoading) return;
    if (!api) {
      setLoading(false);
      return;
    }
    fetchReadiness();
  }, [api, authLoading, fetchReadiness]);

  return { readiness, loading, refresh: fetchReadiness };
}
