'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

/** コストは保存トークン × 価格表からの **推定**（Anthropic はユーザーを識別しない）。 */
const userCostSummarySchema = z.object({
  userId: z.string(),
  email: z.string(),
  fermentationCount: z.number(),
  estimatedCostUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});

const userCostResponseSchema = z.object({
  data: z.array(userCostSummarySchema),
  /** トークン未保存で推定に含められなかった件数。 */
  untrackedCount: z.number(),
  /** 集計上限に達して打ち切られた場合 true（推定は過少）。 */
  truncated: z.boolean(),
});

export type UserCostSummary = z.infer<typeof userCostSummarySchema>;

interface UseUserCostSummaryParams {
  dateFrom?: string;
  dateTo?: string;
}

export function useUserCostSummary(params?: UseUserCostSummaryParams) {
  const dateFrom = params?.dateFrom;
  const dateTo = params?.dateTo;
  const [data, setData] = useState<UserCostSummary[]>([]);
  const [untrackedCount, setUntrackedCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const api = createApiClient(token);
      const searchParams = new URLSearchParams();
      if (dateFrom) searchParams.set('date_from', dateFrom);
      if (dateTo) searchParams.set('date_to', dateTo);
      const qs = searchParams.toString();
      const url = `/api/v1/admin/fermentations/costs/by-user${qs ? `?${qs}` : ''}`;

      const res = await api.fetch(url);
      const body = res.ok ? await parseJson(res, userCostResponseSchema) : null;
      if (body) {
        setData(body.data);
        setUntrackedCount(body.untrackedCount);
        setTruncated(body.truncated);
      } else {
        setError('ユーザー別コストの取得に失敗しました');
      }
    } catch {
      setError('ユーザー別コストの取得に失敗しました');
    } finally {
      // finally に置かないと fetch の reject で loading が固着する。
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, untrackedCount, truncated, loading, error, refresh: fetchData };
}
