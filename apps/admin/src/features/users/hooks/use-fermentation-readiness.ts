'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

// 発酵プロセス自動発火 (issue #268) 条件の現状を表す API レスポンス。
// サーバー側の GetFermentationReadinessUsecase と shape を一致させる。
const fermentationReadinessResponseSchema = z.object({
  userId: z.string(),
  language: z.enum(['ja', 'en']),
  threshold: z.number(),
  charsCurrent: z.number(),
  charScore: z.number(),
  timeScore: z.number(),
  readinessScore: z.number(),
  eligible: z.boolean(),
  isFirstTime: z.boolean(),
  lastRunAt: z.string().nullable(),
  nextEligibleAt: z.string().nullable(),
  hoursElapsed: z.number().nullable(),
  hoursRequired: z.number().nullable(),
});

export type FermentationReadinessResponse = z.infer<typeof fermentationReadinessResponseSchema>;

export function useFermentationReadiness(userId: string) {
  const [data, setData] = useState<FermentationReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadiness = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/fermentations/readiness/${userId}`);
    const json = res.ok ? await parseJson(res, fermentationReadinessResponseSchema) : null;
    if (json) {
      setData(json);
    } else {
      setError('発火条件の取得に失敗しました');
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  return { data, loading, error, refresh: fetchReadiness };
}
