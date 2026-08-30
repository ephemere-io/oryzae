'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const costSummarySchema = z.object({
  currentMonthCost: z.number(),
  lastMonthCost: z.number(),
  projectedCost: z.number(),
  // 保存済みトークン × 価格表からの概算。請求額ではない（Anthropic の Cost API は
  // Admin キー = 組織アカウントが要るため使えない）。古いサーバーからは来ないので既定を持つ。
  estimated: z.boolean().optional(),
  pricingAsOf: z.string().optional(),
});

export type CostSummary = z.infer<typeof costSummarySchema>;

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
    const data = res.ok ? await parseJson(res, costSummarySchema) : null;
    if (data) {
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
