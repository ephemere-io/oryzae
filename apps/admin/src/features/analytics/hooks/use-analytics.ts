'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface AnalyticsOverview {
  totalPageviews: number;
  totalSessions: number;
  avgSessionDurationSeconds: number;
  entryPageViews: number;
  jarPageViews: number;
}

export interface PageViewItem {
  path: string;
  views: number;
}

export interface DailyMetric {
  date: string;
  pageviews: number;
  uniqueUsers: number;
}

interface PagesResponse {
  data: PageViewItem[];
}

interface DailyResponse {
  data: DailyMetric[];
}

interface UseAnalyticsParams {
  dateFrom?: string;
  dateTo?: string;
}

export function useAnalytics(params?: UseAnalyticsParams) {
  const dateFrom = params?.dateFrom ?? '-7d';
  const dateTo = params?.dateTo;
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [pages, setPages] = useState<PageViewItem[]>([]);
  const [daily, setDaily] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const searchParams = new URLSearchParams();
    searchParams.set('date_from', dateFrom);
    if (dateTo) searchParams.set('date_to', dateTo);
    const query = searchParams.toString();

    const [overviewRes, pagesRes, dailyRes] = await Promise.all([
      api.fetch(`/api/v1/admin/analytics/overview?${query}`),
      api.fetch(`/api/v1/admin/analytics/pages?${query}`),
      api.fetch(`/api/v1/admin/analytics/daily?${query}`),
    ]);

    if (overviewRes.ok && pagesRes.ok && dailyRes.ok) {
      setOverview((await overviewRes.json()) as AnalyticsOverview);
      const pagesBody = (await pagesRes.json()) as PagesResponse;
      setPages(pagesBody.data);
      const dailyBody = (await dailyRes.json()) as DailyResponse;
      setDaily(dailyBody.data);
    } else {
      setError('分析データの取得に失敗しました');
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { overview, pages, daily, loading, error, refresh: fetchAll };
}
