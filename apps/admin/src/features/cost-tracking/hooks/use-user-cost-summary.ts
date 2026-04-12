'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface UserCostSummary {
  userId: string;
  email: string;
  fermentationCount: number;
  totalCostUsd: number;
}

interface UserCostResponse {
  data: UserCostSummary[];
}

export function useUserCostSummary() {
  const [data, setData] = useState<UserCostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/fermentations/costs/by-user');
    if (res.ok) {
      const body = (await res.json()) as UserCostResponse;
      setData(body.data);
    } else {
      setError('ユーザー別コストの取得に失敗しました');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
