'use client';

import { useCallback, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson, readErrorMessage } from '@/lib/json';

// issue #290: admin デバッグ用に特定ユーザー / 問いを強制発火する。
// レスポンスは server 側 fireFermentationSchema + FireFermentationUsecase の出力に対応。
//
// emailReason は #290 フォローで追加: 「emailSent: true なのに実際は届かない」
// ことを防ぐための診断情報。'no-verified-email' / 'no-api-key' / 'disabled' /
// 'no-titles' / 'skipped-by-request' のいずれか (server 側 DigestSendResult)。
const fireFermentationResponseSchema = z.object({
  fired: z.array(
    z.object({
      fermentationResultId: z.string(),
      questionId: z.string(),
      questionText: z.string(),
    }),
  ),
  emailSent: z.boolean(),
  emailReason: z.string().optional(),
  emailFailure: z.object({ error: z.string() }).optional(),
});

type FireFermentationResponse = z.infer<typeof fireFermentationResponseSchema>;

interface FireFermentationParams {
  userId: string;
  questionId?: string;
  language?: 'ja' | 'en';
  skipEmail?: boolean;
  // issue #290 フォロー: email_confirmed_at が null のユーザーにも送る
  // (admin が自分の test アカウントに送りたい場面用)。通常フローでは未検証
  // メールにはスパム防止のため送らないが、デバッグ用にバイパスを許す。
  forceUnverified?: boolean;
}

export function useFireFermentation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FireFermentationResponse | null>(null);

  const fire = useCallback(async (params: FireFermentationParams): Promise<boolean> => {
    const token = getAccessToken();
    if (!token) return false;

    setLoading(true);
    setError(null);
    setResult(null);

    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/fermentations/fire', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const body = await parseJson(res, fireFermentationResponseSchema);
      if (body) {
        setResult(body);
        setLoading(false);
        return true;
      }
      setError('発酵プロセスの強制発火に失敗しました（応答の形式が不正です）');
      setLoading(false);
      return false;
    }

    // server は失敗時に { error: string } を返す。可能なら本文を拾って表示する。
    setError(await readErrorMessage(res, '発酵プロセスの強制発火に失敗しました'));
    setLoading(false);
    return false;
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { fire, loading, error, result, reset };
}
