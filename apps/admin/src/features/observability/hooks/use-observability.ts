'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface ObservabilitySummary {
  posthog: { totalPageviews: number; totalSessions: number } | null;
  sentry: { unresolvedCount: number | null };
  gateway: {
    monthlySpend: number | null;
    monthlyRequests: number | null;
    creditBalance: string | null;
    creditUsed: string | null;
  };
  upstash: { totalKeys: number | null };
  vercel: { latestDeployState: string | null };
}

interface AnalyticsOverview {
  totalPageviews: number;
  totalSessions: number;
}

interface SummaryApiResponse {
  sentry: { unresolvedCount: number | null };
  gateway: {
    monthlySpend: number | null;
    monthlyRequests: number | null;
    creditBalance: string | null;
    creditUsed: string | null;
  };
  upstash: { totalKeys: number | null };
  vercel: { latestDeployState: string | null };
}

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

    const summary = (await summaryRes.json()) as SummaryApiResponse;
    let posthog: ObservabilitySummary['posthog'] = null;
    if (analyticsRes.ok) {
      const a = (await analyticsRes.json()) as AnalyticsOverview;
      posthog = { totalPageviews: a.totalPageviews, totalSessions: a.totalSessions };
    }

    setData({ posthog, ...summary });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
