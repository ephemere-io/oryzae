'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

interface UserCostSummary {
  userId: string;
  email: string;
  fermentationCount: number;
  totalCostUsd: number;
}

interface UserCostResponse {
  data: UserCostSummary[];
}

interface UseUserCostSummaryParams {
  dateFrom?: string;
  dateTo?: string;
}

export function useUserCostSummary(params?: UseUserCostSummaryParams) {
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const [data, setData] = useState<UserCostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const searchParams = new URLSearchParams();
    if (dateFrom) searchParams.set('date_from', dateFrom);
    if (dateTo) searchParams.set('date_to', dateTo);
    const qs = searchParams.toString();
    const url = `/api/v1/admin/fermentations/costs/by-user${qs ? `?${qs}` : ''}`;

    const res = await api.fetch(url);
    if (res.ok) {
      const body = (await res.json()) as UserCostResponse;
      setData(body.data);
    } else {
      setError('ユーザー別コストの取得に失敗しました');
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
