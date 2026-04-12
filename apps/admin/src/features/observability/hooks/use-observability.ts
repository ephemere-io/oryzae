'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface ToolMetric {
  label: string;
  value: string;
}

export interface ToolSummary {
  id: string;
  name: string;
  tagline: string;
  href: string | null;
  externalUrl: string;
  metric: ToolMetric | null;
}

interface SummaryResponse {
  tools: ToolSummary[];
}

interface AnalyticsOverview {
  totalPageviews: number;
  totalSessions: number;
}

export function useObservability() {
  const [tools, setTools] = useState<ToolSummary[]>([]);
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

    const summary = (await summaryRes.json()) as SummaryResponse;

    if (analyticsRes.ok) {
      const analytics = (await analyticsRes.json()) as AnalyticsOverview;
      const posthog = summary.tools.find((t) => t.id === 'posthog');
      if (posthog) {
        posthog.metric = {
          label: '今週の PV',
          value: analytics.totalPageviews.toLocaleString(),
        };
      }
    }

    setTools(summary.tools);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { tools, loading, error, refresh: fetchData };
}
