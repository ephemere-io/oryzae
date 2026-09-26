'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

/**
 * 「コスト」ページのデータ（GET /api/v1/admin/costs）。
 *
 *   actual — いくら払ったか（Anthropic の実額）。status が 'ok' 以外のときに 0 を出さないこと
 *            （未設定を「$0」と誤読させるのが issue #490 の症状そのもの）
 *   usage  — 誰がどれだけ使ったか（ai_usage）。金額はトークン × 単価の推定
 */

const featureSchema = z.enum(['fermentation', 'ocr_board', 'ocr_entry']);
export type AiFeature = z.infer<typeof featureSchema>;

const actualSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    totalUsd: z.number(),
    previousTotalUsd: z.number().nullable(),
    previousPeriodLabel: z.string(),
    byWorkspace: z.array(
      z.object({
        name: z.string(),
        costUsd: z.number(),
        previousCostUsd: z.number().nullable(),
        outsideOryzae: z.boolean(),
        keys: z.array(
          z.object({
            label: z.string(),
            inputTokens: z.number(),
            outputTokens: z.number(),
            cacheTokens: z.number(),
          }),
        ),
      }),
    ),
    daily: z.array(z.object({ date: z.string(), costUsd: z.number() })),
    projection: z
      .object({ projectedUsd: z.number(), daysElapsed: z.number(), daysInMonth: z.number() })
      .nullable(),
    truncated: z.boolean(),
  }),
  z.object({ status: z.literal('not-configured') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);

const usageSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    features: z.array(
      z.object({
        feature: featureSchema,
        outcomes: z
          .object({ completed: z.number(), failed: z.number(), total: z.number() })
          .nullable(),
        model: z.string(),
        rate: z.object({ inputUsdPerMTok: z.number(), outputUsdPerMTok: z.number() }),
        count: z.number(),
        userCount: z.number(),
        inputTokens: z.number(),
        outputTokens: z.number(),
        estimatedUsd: z.number(),
      }),
    ),
    users: z.array(
      z.object({
        userId: z.string(),
        label: z.string(),
        counts: z.object({
          fermentation: z.number(),
          ocr_board: z.number(),
          ocr_entry: z.number(),
        }),
        inputTokens: z.number(),
        outputTokens: z.number(),
        estimatedUsd: z.number(),
      }),
    ),
    truncated: z.boolean(),
  }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);

const costsSchema = z.object({
  period: z.object({ from: z.string(), to: z.string(), label: z.string() }),
  actual: actualSchema,
  usage: usageSchema,
  consoleUrl: z.string(),
});

export type CostsData = z.infer<typeof costsSchema>;

/** 期間は UTC 日（YYYY-MM-DD, 両端を含む）。省略すると今月。 */
export function useCosts(range: { from: string; to: string } | null) {
  const [data, setData] = useState<CostsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const from = range?.from;
  const to = range?.to;

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      const res = await createApiClient(token).fetch(`/api/v1/admin/costs${qs ? `?${qs}` : ''}`);
      const body = res.ok ? await parseJson(res, costsSchema) : null;
      if (body) setData(body);
      else setError('コストの取得に失敗しました');
    } catch {
      setError('コストの取得に失敗しました');
    } finally {
      // finally に置かないと、fetch が reject したとき loading が永久に true で固着する。
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
