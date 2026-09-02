'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

/**
 * AI コストは2系統ある。混ぜないこと。
 *  - actual   : Anthropic cost_report の実請求額。UTC 日バケット固定。これが正。
 *  - estimated: 自前トークン × 価格表の推定。Anthropic が知り得ないユーザー別内訳用。
 * どちらも status を持ち、「未設定 / 取得失敗」を $0 と区別できるようにしてある。
 *
 * SpendView は data.actual.status を無条件に参照するので、形の違う応答をそのまま
 * state に入れると描画時に落ちる。キャストではなく実行時に検証して通すこと。
 */
const actualDailyCostSchema = z.object({
  /** UTC 日 (YYYY-MM-DD) */
  date: z.string(),
  costUsd: z.number(),
});

const estimatedDailyCostSchema = z.object({
  date: z.string(),
  estimatedCostUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  fermentationCount: z.number(),
});

const estimatedUserCostSchema = z.object({
  userId: z.string(),
  email: z.string(),
  estimatedCostUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  fermentationCount: z.number(),
});

const spendDataSchema = z.object({
  rangeDays: z.number(),
  actual: z.object({
    status: z.enum(['ok', 'not-configured', 'error']),
    totalCostUsd: z.number().nullable(),
    daily: z.array(actualDailyCostSchema),
    /**
     * ページング打ち切りで実額が過少な場合 true。
     * status === 'ok' のときだけ意味を持つ（失敗時の false は「該当なし」）。
     */
    truncated: z.boolean(),
    message: z.string().nullable(),
  }),
  estimated: z.object({
    status: z.enum(['ok', 'error']),
    /** 推定の計算根拠。画面で検算できるようにサーバーが返す（単価の正は claude-pricing.ts）。 */
    pricing: z.object({
      modelId: z.string(),
      inputUsdPerMTok: z.number(),
      outputUsdPerMTok: z.number(),
    }),
    totalCostUsd: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    fermentationCount: z.number(),
    untrackedCount: z.number(),
    truncated: z.boolean(),
    daily: z.array(estimatedDailyCostSchema),
    byUser: z.array(estimatedUserCostSchema),
  }),
});

export type SpendData = z.infer<typeof spendDataSchema>;

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
      const body = res.ok ? await parseJson(res, spendDataSchema) : null;
      if (body) {
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
