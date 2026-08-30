'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const summaryApiResponseSchema = z.object({
  sentry: z.object({ unresolvedCount: z.number().nullable() }),
  // 実請求額 (Anthropic cost_report)。status で「未設定 / 取得失敗 / 実データ」を
  // 区別する。null と 0 を潰すと未設定を $0 と誤読させるため必ず status を見ること。
  anthropic: z.object({
    status: z.enum(['ok', 'not-configured', 'error']),
    monthlySpend: z.number().nullable(),
    message: z.string().nullable(),
  }),
  resend: z.object({
    sentCount7d: z.number().nullable(),
    bouncedCount7d: z.number().nullable(),
  }),
  upstash: z.object({ totalKeys: z.number().nullable() }),
  vercel: z.object({ latestDeployState: z.string().nullable() }),
});

// overview は totalPageviews / totalSessions だけ使う（他フィールドは無視）。
const analyticsOverviewSchema = z.object({
  totalPageviews: z.number(),
  totalSessions: z.number(),
});

export type ObservabilitySummary = z.infer<typeof summaryApiResponseSchema> & {
  posthog: { totalPageviews: number; totalSessions: number } | null;
};

export function useObservability() {
  const [data, setData] = useState<ObservabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const [summaryRes, analyticsRes] = await Promise.all([
      api.fetch('/api/v1/admin/observability/summary'),
      api.fetch('/api/v1/admin/analytics/overview?date_from=-7d'),
    ]);

    if (!summaryRes.ok) {
      setError('監視データの取得に失敗しました');
      setLoading(false);
      return;
    }

    const summary = await parseJson(summaryRes, summaryApiResponseSchema);
    if (!summary) {
      setError('監視データの取得に失敗しました');
      setLoading(false);
      return;
    }

    let posthog: ObservabilitySummary['posthog'] = null;
    if (analyticsRes.ok) {
      const a = await parseJson(analyticsRes, analyticsOverviewSchema);
      if (a) posthog = { totalPageviews: a.totalPageviews, totalSessions: a.totalSessions };
    }

    setData({ posthog, ...summary });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
