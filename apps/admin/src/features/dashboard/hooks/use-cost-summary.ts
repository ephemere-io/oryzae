'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/**
 * 月次コスト。保存トークン × 公表単価からの **推定**。
 * 実請求額は Anthropic Console (platform.claude.com/cost) で確認する。
 */
export interface CostSummary {
  currentMonthCost: number;
  lastMonthCost: number;
  projectedCost: number;
  /** トークン未保存で推定に含められなかった件数。 */
  untrackedCount: number;
  /** 集計上限に達して打ち切られた場合 true（推定は過少）。 */
  truncated: boolean;
  daysElapsed: number;
  daysInMonth: number;
}

export function useCostSummary() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCostSummary = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/dashboard/cost-summary');
    if (res.ok) {
      const data = (await res.json()) as CostSummary; // @type-assertion-allowed: APIレスポンスの型をキャスト
      setSummary(data);
    } else {
      setError('コスト情報の取得に失敗しました');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCostSummary();
  }, [fetchCostSummary]);

  return { summary, loading, error, refresh: fetchCostSummary };
}
