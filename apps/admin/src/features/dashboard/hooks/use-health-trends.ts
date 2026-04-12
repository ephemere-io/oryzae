'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface TrendDay {
  date: string;
  successRate: number;
  activeWriters: number;
}

export function useHealthTrends(dateFrom?: string, dateTo?: string) {
  const [days, setDays] = useState<TrendDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const qs = params.toString();

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/dashboard/trends${qs ? `?${qs}` : ''}`);
    if (res.ok) {
      const data: unknown = await res.json();
      if (Array.isArray(data)) {
        setDays(data as TrendDay[]); // @type-assertion-allowed: APIレスポンスの型をバリデーション後にキャスト
      }
    } else {
      setError('トレンドデータの取得に失敗しました');
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return { days, loading, error, refresh: fetchTrends };
}
