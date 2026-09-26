'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

/**
 * AI コストは2系統ある。混ぜないこと。
 *  - actual   : Anthropic cost_report の実請求額。**org 全体**の額で、Oryzae のアプリ
 *               以外（CI のレビュー等）も含む。UTC 日バケット固定。これが正。
 *  - estimated: 自前トークン × 価格表の推定。**発酵のみ・記録できた分だけ**。
 *
 * したがって 実請求 ≧ 推定 が常態で、差は「推定に含めていない利用」を意味する。
 *
 * **用途別の内訳は actual 側にある**（actual.byWorkspace）。機能ごとに API キーと
 * Workspace を分けてあるので、Workspace 別の実額がそのまま用途別の実額になる。
 * 推定で OCR を出す必要はない。モデル別（actual.byModel）は単価の検算用で、
 * 同じモデルを複数の用途が使うため用途の軸にはならない。
 *
 * estimated が残っているのは **ユーザー別内訳** のためだけ。Anthropic は Oryzae の
 * ユーザーを知らないので、その軸だけは実額で出せない。
 *
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

/**
 * モデル別の **実額**。合計は actual.totalCostUsd と一致する。
 *
 * **用途の軸ではない。** 同じモデルを複数の機能と CI が使うため、ここから
 * 「どの機能にいくらかかったか」は読めない。用途別は byWorkspace を見る。
 */
const actualModelCostSchema = z.object({
  model: z.string(),
  costUsd: z.number(),
  byTokenType: z.array(z.object({ tokenType: z.string(), costUsd: z.number() })),
});

/**
 * Workspace 別の **実額** = 用途別の実額。合計は actual.totalCostUsd と一致する。
 *
 * Oryzae は機能ごとに API キーを分け、キーごとに Workspace を分けてある。
 * workspaceName は Anthropic 側の名前そのままで、画面で用途名に読み替えない
 * （読み替え表を持つと Console 側の改名に追従できず、古い名前を出し続ける）。
 */
const actualWorkspaceCostSchema = z.object({
  workspaceId: z.string().nullable(),
  workspaceName: z.string(),
  costUsd: z.number(),
  byModel: z.array(z.object({ model: z.string(), costUsd: z.number() })),
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
    byModel: z.array(actualModelCostSchema),
    /** 用途別（Workspace 別）の実額。画面で最初に見せるのはこちら。 */
    byWorkspace: z.array(actualWorkspaceCostSchema),
    /** 内訳が返らなかった場合 true。空の byModel を「内訳ゼロ」と読ませない。 */
    groupingUnavailable: z.boolean(),
    /** Workspace 名が引けず ID 表示になっている場合 true。 */
    workspaceNamesUnavailable: z.boolean(),
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
      const res = await api.fetch(`/api/v1/admin/tools/spend?date_from=${rangeDays}`);
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
