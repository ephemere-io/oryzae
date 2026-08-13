'use client';

import { useEffect, useState } from 'react';
import { normalizeDetail } from '@/features/shared/fermentation/normalize';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

interface UseFermentationDetailResult {
  detail: FermentationDetail | null;
  loading: boolean;
}

/**
 * 発酵1件の詳細（手紙・言葉・抜粋）を id で取得する。端末非依存。
 *
 * Issue #490: SP の瓶（受信箱から開く）と PC の瓶/エディタが同じエンドポイントを
 * 別実装で叩いていたため統合した。
 */
export function useFermentationDetail(
  api: ApiClient | null,
  fermentationId: string | null,
): UseFermentationDetailResult {
  const [detail, setDetail] = useState<FermentationDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api || !fermentationId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.fetch(`/api/v1/fermentations/${fermentationId}`).then(async (res) => {
      if (cancelled) return;
      if (res.ok) setDetail(normalizeDetail(await res.json()));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, fermentationId]);

  return { detail, loading };
}
