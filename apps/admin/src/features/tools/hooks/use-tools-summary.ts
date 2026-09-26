'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const envVarSchema = z.object({ name: z.string(), set: z.boolean() });

const summaryApiResponseSchema = z.object({
  // ツール id → そのツールのために admin のデプロイが読む環境変数の有無（値は来ない）。
  env: z.record(z.string(), z.array(envVarSchema)),
  // status で「未設定 / 取得失敗 / 実データ」を区別する。null を 0 と潰すと
  // 「エラー無し」と誤読させる（2026-09 まで実際にそうなっていた）。
  sentry: z.object({
    status: z.enum(['ok', 'not-configured', 'error']),
    unresolvedCount: z.number().nullable(),
  }),
  // 実請求額 (Anthropic cost_report)。null と 0 を潰すと未設定を $0 と誤読させる。
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

export type EnvVarPresence = z.infer<typeof envVarSchema>;

export type ToolsSummary = z.infer<typeof summaryApiResponseSchema> & {
  posthog: { totalPageviews: number; totalSessions: number } | null;
};

export function useToolsSummary() {
  const [data, setData] = useState<ToolsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const [summaryRes, analyticsRes] = await Promise.all([
      api.fetch('/api/v1/admin/tools/summary'),
      api.fetch('/api/v1/admin/analytics/overview?date_from=-7d'),
    ]);

    if (!summaryRes.ok) {
      setError('ツールの状態を取得できませんでした');
      setLoading(false);
      return;
    }

    const summary = await parseJson(summaryRes, summaryApiResponseSchema);
    if (!summary) {
      setError('ツールの状態を取得できませんでした');
      setLoading(false);
      return;
    }

    let posthog: ToolsSummary['posthog'] = null;
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
