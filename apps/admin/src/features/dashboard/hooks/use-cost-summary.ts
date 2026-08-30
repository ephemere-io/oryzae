'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/**
 * 月次コスト。実請求額 (Anthropic cost_report) と 推定 (自前トークン × 価格表) を
 * 分けて持つ。actual.status が 'ok' でないときに 0 を表示しないこと
 * （未設定を「$0」と誤読させるのが issue #490 で報告された症状そのもの）。
 */
export interface CostSummary {
  actual: {
    status: 'ok' | 'not-configured' | 'error';
    currentMonthCost: number | null;
    lastMonthCost: number | null;
    message: string | null;
  };
  estimated: {
    currentMonthCost: number;
    lastMonthCost: number;
    untrackedCount: number;
    truncated: boolean;
  };
  projectedCost: number;
  projectionBasis: 'actual' | 'estimated';
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
