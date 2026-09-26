'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const issueSchema = z.object({
  id: z.string(),
  shortId: z.string(),
  title: z.string(),
  culprit: z.string(),
  level: z.string(),
  count: z.number(),
  userCount: z.number(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  permalink: z.string(),
  isUnhandled: z.boolean(),
  isNew: z.boolean(),
});

const errorsResponseSchema = z.object({
  // 空の issues を「エラー無し」と読ませないため、必ず status を先に見ること。
  status: z.enum(['ok', 'not-configured', 'error']),
  missing: z.array(z.string()),
  message: z.string().nullable(),
  environment: z.string(),
  // この admin のデプロイに送信側の DSN があるか（client は別プロジェクトで見えない）。
  sending: z.object({ server: z.boolean(), browser: z.boolean() }),
  consoleUrl: z.string().nullable(),
  issues: z.array(issueSchema),
  daily: z.array(z.object({ date: z.string(), events: z.number() })),
  truncated: z.boolean(),
});

export type ErrorsData = z.infer<typeof errorsResponseSchema>;
export type ErrorIssue = z.infer<typeof issueSchema>;

export function useErrors() {
  const [data, setData] = useState<ErrorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/errors');
    const body = res.ok ? await parseJson(res, errorsResponseSchema) : null;
    if (body) {
      setData(body);
    } else {
      setError('エラー情報を取得できませんでした');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
