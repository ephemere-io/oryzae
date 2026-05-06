'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

// 発酵プロセス自動発火 (issue #268) 条件の現状を表す API レスポンス。
// サーバー側の GetFermentationReadinessUsecase と shape を一致させる。
export interface FermentationReadinessResponse {
  userId: string;
  language: 'ja' | 'en';
  threshold: number;
  charsCurrent: number;
  charScore: number;
  timeScore: number;
  readinessScore: number;
  eligible: boolean;
  isFirstTime: boolean;
  lastRunAt: string | null;
  nextEligibleAt: string | null;
  hoursElapsed: number | null;
  hoursRequired: number | null;
}

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
    if (res.ok) {
      const json = (await res.json()) as FermentationReadinessResponse;
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
