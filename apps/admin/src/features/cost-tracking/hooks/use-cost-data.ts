'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface CostItem {
  id: string;
  user_id: string;
  status: string;
  generation_id: string | null;
  created_at: string;
  cost: {
    totalCost: number;
    promptTokens: number;
    completionTokens: number;
    latency: number;
  } | null;
}

interface CostDataResponse {
  data: CostItem[];
  pagination: { page: number; limit: number; total: number };
}

interface UseCostDataParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export function useCostData(params?: UseCostDataParams) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const [data, setData] = useState<CostItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
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

    const res = await api.fetch(`/api/v1/admin/fermentations/costs?${searchParams.toString()}`);
    if (res.ok) {
      const body = (await res.json()) as CostDataResponse;
      setData(body.data);
      setPagination(body.pagination);
    } else {
      setError('コストデータの取得に失敗しました');
    }
    setLoading(false);
  }, [page, limit, dateFrom, dateTo]);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  return { data, pagination, loading, error, refresh: fetchCosts };
}
