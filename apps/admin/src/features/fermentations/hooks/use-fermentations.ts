'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const fermentationItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  user_email: z.string(),
  question_id: z.string(),
  target_period: z.string(),
  status: z.string(),
  generation_id: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  cost: z
    .object({
      totalCost: z.number(),
      promptTokens: z.number(),
      completionTokens: z.number(),
    })
    .nullable(),
});

const fermentationsResponseSchema = z.object({
  data: z.array(fermentationItemSchema),
  pagination: z.object({ page: z.number(), limit: z.number(), total: z.number() }),
});

export type FermentationItem = z.infer<typeof fermentationItemSchema>;

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
    const body = res.ok ? await parseJson(res, fermentationsResponseSchema) : null;
    if (body) {
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
