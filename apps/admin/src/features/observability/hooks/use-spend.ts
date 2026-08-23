'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/**
 * AI コストは保存トークン × 公表単価からの **推定**。
 * 実請求額は Anthropic の Console (platform.claude.com/cost) で確認する
 * （API で取るには Admin key = org 契約が必要なため、ここでは扱わない）。
 * 取得失敗を $0 と区別できるよう status を持たせてある。
 */
interface EstimatedDailyCost {
  date: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  fermentationCount: number;
}

interface EstimatedUserCost {
  userId: string;
  email: string;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  fermentationCount: number;
}

export interface SpendData {
  rangeDays: number;
  estimated: {
    status: 'ok' | 'error';
    totalCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    fermentationCount: number;
    untrackedCount: number;
    truncated: boolean;
    daily: EstimatedDailyCost[];
    byUser: EstimatedUserCost[];
  };
}

export function useSpend(rangeDays = 30) {
  const [data, setData] = useState<SpendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const api = createApiClient(token);
      const res = await api.fetch(`/api/v1/admin/observability/spend?date_from=${rangeDays}`);
      if (res.ok) {
        // @type-assertion-allowed: API レスポンスの JSON を宣言済みの型に束ねる
        const body = (await res.json()) as SpendData;
        setData(body);
      } else {
        setError('コストデータの取得に失敗しました');
      }
    } catch {
      setError('コストデータの取得に失敗しました');
    } finally {
      // finally に置かないと、fetch が reject したとき loading が永久に true で固着する。
      setLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
