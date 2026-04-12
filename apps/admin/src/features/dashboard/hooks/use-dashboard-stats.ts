'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface DashboardStats {
  totalUsers: number;
  totalEntries: number;
  totalFermentations: number;
  completedFermentations: number;
  failedFermentations: number;
  fermentationsWithCostTracking: number;
}

interface UseDashboardStatsParams {
  dateFrom?: string;
  dateTo?: string;
}

export function useDashboardStats(params?: UseDashboardStatsParams) {
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const searchParams = new URLSearchParams();
    if (dateFrom) searchParams.set('date_from', dateFrom);
    if (dateTo) searchParams.set('date_to', dateTo);
    const qs = searchParams.toString();
    const url = `/api/v1/admin/dashboard/stats${qs ? `?${qs}` : ''}`;

    const res = await api.fetch(url);
    if (res.ok) {
      const data = (await res.json()) as DashboardStats;
      setStats(data);
    } else {
      setError('統計情報の取得に失敗しました');
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}
