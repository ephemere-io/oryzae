'use client';

import { useCallback, useEffect, useState } from 'react';
import { normalizeDetail, normalizeSummaries } from '@/features/shared/fermentation/normalize';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

interface UseFermentationForQuestionResult {
  /** 最新の完了済み発酵の詳細。存在しなければ null。 */
  detail: FermentationDetail | null;
  loading: boolean;
}

/**
 * 問いに紐づく「最新の完了済み発酵」の詳細を取得する。端末非依存。
 *
 * Issue #490: 統合前は PC の瓶（use-fermentation-results）とエディタの発酵オーバーレイ
 * （use-entry-fermentation-detail）が同じ2エンドポイントを別実装で叩いていた。
 * 最新1件の選び方は **createdAt 降順の先頭**（旧 entries 実装）に寄せる。旧 jar 実装は
 * API の返却順に依存した find だったため、順序が変わると結果が揺れていた。
 */
export function useFermentationForQuestion(
  api: ApiClient | null,
  questionId: string | undefined,
): UseFermentationForQuestionResult {
  const [detail, setDetail] = useState<FermentationDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!api || !questionId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setDetail(null);
    try {
      const res = await api.fetch(`/api/v1/fermentations?questionId=${questionId}`);
      if (!res.ok) return;
      const latest = normalizeSummaries(await res.json())
        .filter((s) => s.status === 'completed')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!latest) return;

      const detailRes = await api.fetch(`/api/v1/fermentations/${latest.id}`);
      if (!detailRes.ok) return;
      const normalized = normalizeDetail(await detailRes.json());
      // 完了済みの詳細だけを見せる（途中経過は瓶にもオーバーレイにも出さない）。
      setDetail(normalized?.status === 'completed' ? normalized : null);
    } finally {
      setLoading(false);
    }
  }, [api, questionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { detail, loading };
}
