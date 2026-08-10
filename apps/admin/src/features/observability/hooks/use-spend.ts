'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/**
 * AI コストは2系統ある。混ぜないこと。
 *  - actual   : Anthropic cost_report の実請求額。UTC 日バケット固定。これが正。
 *  - estimated: 自前トークン × 価格表の推定。Anthropic が知り得ないユーザー別内訳用。
 * どちらも status を持ち、「未設定 / 取得失敗」を $0 と区別できるようにしてある。
 */
type FetchStatus = 'ok' | 'not-configured' | 'error';

interface ActualDailyCost {
  /** UTC 日 (YYYY-MM-DD) */
  date: string;
  costUsd: number;
}

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
  actual: {
    status: FetchStatus;
    totalCostUsd: number | null;
    daily: ActualDailyCost[];
    message: string | null;
  };
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
