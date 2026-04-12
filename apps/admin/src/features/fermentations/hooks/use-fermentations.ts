'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface FermentationItem {
  id: string;
  user_id: string;
  question_id: string;
  entry_id: string;
  target_period: string;
  status: string;
  generation_id: string | null;
  created_at: string;
  updated_at: string;
}

interface FermentationsResponse {
  data: FermentationItem[];
  pagination: { page: number; limit: number; total: number };
}

export function useFermentations(page = 1, limit = 30) {
  const [data, setData] = useState<FermentationItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/fermentations?page=${page}&limit=${limit}`);
    if (res.ok) {
      const body = (await res.json()) as FermentationsResponse;
      setData(body.data);
      setPagination(body.pagination);
    } else {
      setError('発酵データの取得に失敗しました');
    }
    setLoading(false);
  }, [page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, pagination, loading, error, refresh: fetchData };
}
