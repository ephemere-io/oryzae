'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

/**
 * latency はかつて AI Gateway が返していたが、Anthropic 直叩き (#352) 以降は
 * 存在しない。型としては必須のまま列を出していたので常に "-" だった → 列ごと廃止。
 */
const costItemSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  user_email: z.string(),
  status: z.string(),
  generation_id: z.string().nullable(),
  created_at: z.string(),
  cost: z
    .object({
      totalCost: z.number(),
      promptTokens: z.number(),
      completionTokens: z.number(),
    })
    .nullable(),
});

const costDataResponseSchema = z.object({
  data: z.array(costItemSchema),
  pagination: z.object({ page: z.number(), limit: z.number(), total: z.number() }),
});

export type CostItem = z.infer<typeof costItemSchema>;

interface UseCostDataParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
}

export function useCostData(params?: UseCostDataParams) {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 30;
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const userId = params?.userId;
  const [data, setData] = useState<CostItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0 });
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
    if (userId) searchParams.set('user_id', userId);

    const res = await api.fetch(`/api/v1/admin/fermentations/costs?${searchParams.toString()}`);
    const body = res.ok ? await parseJson(res, costDataResponseSchema) : null;
    if (body) {
      setData(body.data);
      setPagination(body.pagination);
    } else {
      setError('コストデータの取得に失敗しました');
    }
    setLoading(false);
  }, [page, limit, dateFrom, dateTo, userId]);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  return { data, pagination, loading, error, refresh: fetchCosts };
}
