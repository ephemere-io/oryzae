'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface ObservabilitySummary {
  posthog: { totalPageviews: number; totalSessions: number } | null;
  sentry: { unresolvedCount: number | null };
  // 実請求額 (Anthropic cost_report)。status で「未設定 / 取得失敗 / 実データ」を
  // 区別する。null と 0 を潰すと未設定を $0 と誤読させるため必ず status を見ること。
  anthropic: {
    status: 'ok' | 'not-configured' | 'error';
    monthlySpend: number | null;
    message: string | null;
  };
  resend: { sentCount7d: number | null; bouncedCount7d: number | null };
  upstash: { totalKeys: number | null };
  vercel: { latestDeployState: string | null };
}

interface AnalyticsOverview {
  totalPageviews: number;
  totalSessions: number;
}

interface SummaryApiResponse {
  sentry: { unresolvedCount: number | null };
  // 実請求額 (Anthropic cost_report)。status で「未設定 / 取得失敗 / 実データ」を
  // 区別する。null と 0 を潰すと未設定を $0 と誤読させるため必ず status を見ること。
  anthropic: {
    status: 'ok' | 'not-configured' | 'error';
    monthlySpend: number | null;
    message: string | null;
  };
  resend: { sentCount7d: number | null; bouncedCount7d: number | null };
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
