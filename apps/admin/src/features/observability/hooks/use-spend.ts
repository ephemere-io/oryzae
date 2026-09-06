'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

/**
 * AI コストは2系統ある。混ぜないこと。
 *  - actual   : Anthropic cost_report の実請求額。**org 全体**の額で、Oryzae のアプリ
 *               以外（CI のレビュー等）も含む。UTC 日バケット固定。請求としてはこれが正。
 *  - estimated: 自前トークン × 価格表の推定。**Oryzae が記録した呼び出しだけ**を数える。
 *               Anthropic が知り得ないユーザー別内訳もこちら。
 * したがって 実請求 ≧ 推定 が常態で、差は「記録していない利用」を意味する。
 *
 * 推定はさらに発酵と OCR に割れている。単価が違う（発酵 claude-sonnet-4-6 $3/$15、
 * OCR claude-opus-5 $5/$25）ので合算してから一律単価は掛けられない。
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

const ocrDailyCostSchema = z.object({
  date: z.string(),
  estimatedCostUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  requestCount: z.number(),
});

const estimatedUserCostSchema = z.object({
  userId: z.string(),
  email: z.string(),
  estimatedCostUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  fermentationCount: z.number(),
});

const ocrUserCostSchema = z.object({
  userId: z.string(),
  email: z.string(),
  estimatedCostUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  requestCount: z.number(),
});

/** 単価はサーバー (claude-pricing.ts) が唯一の正。画面側で持たない。 */
const pricingSchema = z.object({
  modelId: z.string(),
  inputUsdPerMTok: z.number(),
  outputUsdPerMTok: z.number(),
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
    /** 'partial' = OCR だけ取得できていない。合計が過少なので ok とは区別する。 */
    status: z.enum(['ok', 'partial', 'error']),
    /** 発酵 + OCR。実請求額と突き合わせる相手はこの合計。 */
    totalCostUsd: z.number(),
    truncated: z.boolean(),
    fermentation: z.object({
      pricing: pricingSchema,
      totalCostUsd: z.number(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      fermentationCount: z.number(),
      untrackedCount: z.number(),
      truncated: z.boolean(),
      daily: z.array(estimatedDailyCostSchema),
      byUser: z.array(estimatedUserCostSchema),
    }),
    ocr: z.object({
      status: z.enum(['ok', 'error']),
      pricing: pricingSchema,
      totalCostUsd: z.number(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      requestCount: z.number(),
      untrackedCount: z.number(),
      truncated: z.boolean(),
      daily: z.array(ocrDailyCostSchema),
      byModel: z.array(
        z.object({
          model: z.string(),
          requestCount: z.number(),
          estimatedCostUsd: z.number(),
          inputTokens: z.number(),
          outputTokens: z.number(),
          unpriced: z.boolean(),
        }),
      ),
      byUser: z.array(ocrUserCostSchema),
    }),
  }),
});

export type SpendData = z.infer<typeof spendDataSchema>;
/** 発酵・OCR で共通の単価の形。画面はこれを引数で受け取り、固定値を持たない。 */
export type SpendPricing = z.infer<typeof pricingSchema>;

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
