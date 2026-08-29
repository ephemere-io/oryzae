'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson, readErrorMessage } from '@/lib/json';

const analyticsOverviewSchema = z.object({
  totalPageviews: z.number(),
  totalSessions: z.number(),
  avgSessionDurationSeconds: z.number(),
  entryPageViews: z.number(),
  jarPageViews: z.number(),
});

const pageViewItemSchema = z.object({
  path: z.string(),
  views: z.number(),
});

const dailyMetricSchema = z.object({
  date: z.string(),
  pageviews: z.number(),
  uniqueUsers: z.number(),
});

const pagesResponseSchema = z.object({ data: z.array(pageViewItemSchema) });
const dailyResponseSchema = z.object({ data: z.array(dailyMetricSchema) });

export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;
export type PageViewItem = z.infer<typeof pageViewItemSchema>;
export type DailyMetric = z.infer<typeof dailyMetricSchema>;

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
      const [overviewBody, pagesBody, dailyBody] = await Promise.all([
        parseJson(overviewRes, analyticsOverviewSchema),
        parseJson(pagesRes, pagesResponseSchema),
        parseJson(dailyRes, dailyResponseSchema),
      ]);
      if (overviewBody && pagesBody && dailyBody) {
        setOverview(overviewBody);
        setPages(pagesBody.data);
        setDaily(dailyBody.data);
      } else {
        setError('分析データの取得に失敗しました（応答の形式が不正です）');
      }
    } else {
      // サーバーが返す具体的なエラー（PostHog 未設定 / 取得失敗 (HTTP xxx) 等）を優先表示。
      // 以前は失敗が握りつぶされ「全部 0」に見えていたため、原因が分かるようにする。
      const failed = [overviewRes, pagesRes, dailyRes].find((r) => !r.ok);
      setError(
        failed
          ? await readErrorMessage(failed, '分析データの取得に失敗しました')
          : '分析データの取得に失敗しました',
      );
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { overview, pages, daily, loading, error, refresh: fetchAll };
}
