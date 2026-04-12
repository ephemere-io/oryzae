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
  purpose: string;
  configured: boolean;
  adminPath: string | null;
  externalUrl: string;
  externalLabel: string;
  metrics: ToolMetric[];
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

    // Merge PostHog metrics from analytics API
    if (analyticsRes.ok) {
      const analytics = (await analyticsRes.json()) as AnalyticsOverview;
      const posthog = summary.tools.find((t) => t.id === 'posthog');
      if (posthog) {
        posthog.metrics = [
          { label: '今週の PV', value: analytics.totalPageviews.toLocaleString() },
          { label: 'セッション', value: analytics.totalSessions.toLocaleString() },
        ];
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
