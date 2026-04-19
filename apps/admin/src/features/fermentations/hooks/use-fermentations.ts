'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface FermentationItem {
  id: string;
  user_id: string;
  user_email: string;
  question_id: string;
  entry_id: string;
  target_period: string;
  status: string;
  generation_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface FermentationsResponse {
  data: FermentationItem[];
  pagination: { page: number; limit: number; total: number };
}

interface UseFermentationsParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  status?: string;
}

export function useFermentations(params?: UseFermentationsParams) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 30;
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const userId = params?.userId;
  const status = params?.status;
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
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('limit', String(limit));
    if (dateFrom) searchParams.set('date_from', dateFrom);
    if (dateTo) searchParams.set('date_to', dateTo);
    if (userId) searchParams.set('user_id', userId);
    if (status) searchParams.set('status', status);

    const res = await api.fetch(`/api/v1/admin/fermentations?${searchParams.toString()}`);
    if (res.ok) {
      const body = (await res.json()) as FermentationsResponse;
      setData(body.data);
      setPagination(body.pagination);
    } else {
      setError('発酵データの取得に失敗しました');
    }
    setLoading(false);
  }, [page, limit, dateFrom, dateTo, userId, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retryFermentation = useCallback(
    async (id: string): Promise<boolean> => {
      const token = getAccessToken();
      if (!token) return false;

      const api = createApiClient(token);
      const res = await api.fetch(`/api/v1/admin/fermentations/${id}/retry`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
        return true;
      }
      return false;
    },
    [fetchData],
  );

  return { data, pagination, loading, error, refresh: fetchData, retryFermentation };
}
