'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

/**
 * 月次コスト。実請求額 (Anthropic cost_report) と 推定 (自前トークン × 価格表) を
 * 分けて持つ。actual.status が 'ok' でないときに 0 を表示しないこと
 * （未設定を「$0」と誤読させるのが issue #490 で報告された症状そのもの）。
 */
const costSummarySchema = z.object({
  actual: z.object({
    status: z.enum(['ok', 'not-configured', 'error']),
    currentMonthCost: z.number().nullable(),
    lastMonthCost: z.number().nullable(),
    message: z.string().nullable(),
  }),
  estimated: z.object({
    currentMonthCost: z.number(),
    lastMonthCost: z.number(),
    untrackedCount: z.number(),
    truncated: z.boolean(),
  }),
  projectedCost: z.number(),
  projectionBasis: z.enum(['actual', 'estimated']),
  daysElapsed: z.number(),
  daysInMonth: z.number(),
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
