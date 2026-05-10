'use client';

import { useCallback, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

// issue #290: admin デバッグ用に特定ユーザー / 問いを強制発火する。
// レスポンスは server 側 fireFermentationSchema + FireFermentationUsecase の出力に対応。
//
// emailReason は #290 フォローで追加: 「emailSent: true なのに実際は届かない」
// ことを防ぐための診断情報。'no-verified-email' / 'no-api-key' / 'disabled' /
// 'no-titles' / 'skipped-by-request' のいずれか (server 側 DigestSendResult)。
interface FireFermentationResponse {
  fired: Array<{
    fermentationResultId: string;
    questionId: string;
    questionText: string;
  }>;
  emailSent: boolean;
  emailReason?: string;
  emailFailure?: { error: string };
}

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
      const body = (await res.json()) as FireFermentationResponse;
      setResult(body);
      setLoading(false);
      return true;
    }

    // server は失敗時に { error: string } を返す。可能なら本文を拾って表示する。
    let message = '発酵プロセスの強制発火に失敗しました';
    try {
      const body = (await res.json()) as { error?: string };
      if (typeof body.error === 'string' && body.error.length > 0) message = body.error;
    } catch {
      // body が JSON でない (HTML / 空) 場合はデフォルト文言のまま
    }
    setError(message);
    setLoading(false);
    return false;
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { fire, loading, error, result, reset };
}
