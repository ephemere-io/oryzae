'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/** コストは保存トークン × 価格表からの **推定**（Anthropic はユーザーを識別しない）。 */
export interface UserCostSummary {
  userId: string;
  email: string;
  fermentationCount: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
}

interface UserCostResponse {
  data: UserCostSummary[];
  /** トークン未保存で推定に含められなかった件数。 */
  untrackedCount: number;
  /** 集計上限に達して打ち切られた場合 true（推定は過少）。 */
  truncated: boolean;
}

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
      if (res.ok) {
        // @type-assertion-allowed: API レスポンスの JSON を宣言済みの型に束ねる
        const body = (await res.json()) as UserCostResponse;
        // フォールバックは置かない。server は admin の Next アプリに同梱されて
        // 一緒にデプロイされるため、型と実際のレスポンスが食い違うことはない。
        // `?? 0` を書くと「必須と宣言しているのに欠けうる」という矛盾になる。
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
