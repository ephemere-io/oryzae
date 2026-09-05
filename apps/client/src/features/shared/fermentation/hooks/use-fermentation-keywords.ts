'use client';

import { useMemo } from 'react';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import type { ApiClient } from '@/lib/api';

/**
 * 複数の発酵から言葉（キーワード）をまとめて集める。
 *
 * 書斎の瓶に浮かべるのは「**問いごとの最新のキーワード**」。受信箱（use-fermentation-inbox）が
 * 問いごとに最新 1 通へ畳んでくれるので、その全部の詳細を引けばよい。
 *
 * 詳細の取得そのものは `use-fermentation-details` が持つ（SP の瓶は同じ詳細から
 * 言葉と抜粋の両方を出すため）。ここはそこから言葉だけを取り出す薄い層。
 */
export function useFermentationKeywords(
  api: ApiClient | null,
  fermentationIds: readonly string[],
): { keywords: string[]; loading: boolean } {
  const { details, loading } = useFermentationDetails(api, fermentationIds);

  const keywords = useMemo(() => {
    const words: string[] = [];
    for (const detail of details.values()) {
      for (const keyword of detail.keywords) words.push(keyword.keyword);
    }
    // 同じ言葉が別の問いから出ることがある。瓶の中で二重に浮かべない。
    return [...new Set(words)].filter((word) => word.length > 0);
  }, [details]);

  return { keywords, loading };
}
