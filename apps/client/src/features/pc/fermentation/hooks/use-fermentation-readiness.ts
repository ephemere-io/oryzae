'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

// issue #278: 発酵瓶アニメーション用に「ユーザーが現在どこまで発酵に近いか」を取得する。
// PR #291 以降 readiness は問い単位なので、サーバーは active な問い 1 件あたり [0, 1]
// の readiness を計算した合計 (totalReadiness, [0, 3]) を返す。
//   - 1.0 = 1 問が発火直前 → 瓶は「かなり熟成」
//   - 2.0 = 複数問が活性化 → 微生物の動きが活発
//   - 3.0 = 全 3 問が発火寸前 → ぶくぶく激しく泡立つ
//
// 設計判断: 次回 eligible 時刻は意図的にサーバーから返さない (受け入れ基準: ユーザーには
// 「いつ来るか分からない」体験を維持する)。値も UI に数値として露出させない。
interface FermentationReadinessResponse {
  totalReadiness: number;
  questionCount: number;
  language: 'ja' | 'en';
}

// API レスポンスは unknown として受け取り、型ガードで絞り込む（`as` キャスト禁止）。
// 形状が不正なら null 扱いにして UI を壊さない。
function isFermentationReadinessResponse(value: unknown): value is FermentationReadinessResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'totalReadiness' in value &&
    typeof value.totalReadiness === 'number' &&
    'questionCount' in value &&
    typeof value.questionCount === 'number' &&
    'language' in value &&
    (value.language === 'ja' || value.language === 'en')
  );
}

interface UseFermentationReadinessResult {
  readiness: FermentationReadinessResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useFermentationReadiness(
  api: ApiClient | null,
  authLoading: boolean,
): UseFermentationReadinessResult {
  const [readiness, setReadiness] = useState<FermentationReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReadiness = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    const res = await api.fetch('/api/v1/fermentations/readiness');
    if (res.ok) {
      const json: unknown = await res.json();
      if (isFermentationReadinessResponse(json)) {
        setReadiness(json);
      }
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (authLoading) return;
    if (!api) {
      setLoading(false);
      return;
    }
    fetchReadiness();
  }, [api, authLoading, fetchReadiness]);

  return { readiness, loading, refresh: fetchReadiness };
}
