'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const trendsResponseSchema = z.object({
  days: z.array(
    z.object({
      date: z.string(),
      totalFermentations: z.number(),
      completedFermentations: z.number(),
      activeWriters: z.number(),
    }),
  ),
});

export interface TrendDay {
  date: string;
  totalFermentations: number;
  completedFermentations: number;
  /** その日の漬け込みが 0 件なら null。0% だと「全部失敗した日」と見分けが付かない */
  successRate: number | null;
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
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    const qs = params.toString();

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/dashboard/trends${qs ? `?${qs}` : ''}`);
    const body = res.ok ? await parseJson(res, trendsResponseSchema) : null;
    if (body) {
      setDays(
        body.days.map((d) => ({
          ...d,
          successRate:
            d.totalFermentations > 0
              ? (d.completedFermentations / d.totalFermentations) * 100
              : null,
        })),
      );
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
