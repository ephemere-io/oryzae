'use client';

import { useMemo } from 'react';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import type { JarWord } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';

/**
 * 複数の発酵から言葉（キーワード）をまとめて集める。
 *
 * 書斎の瓶に浮かべるのは「**問いごとの最新のキーワード**」。受信箱（use-fermentation-inbox）が
 * 問いごとに最新 1 通へ畳んでくれるので、その全部の詳細を引けばよい。
 *
 * 詳細の取得そのものは `use-fermentation-details` が持つ（SP の瓶は同じ詳細から
 * 言葉と抜粋の両方を出すため）。ここはそこから言葉だけを取り出す薄い層。
 *
 * 語だけでなく**出どころの問い**も一緒に返す。書斎の瓶に浮かぶ語が何を指すのか
 * 読み取れない、という指摘への手掛かりで、語だけ渡すと後から復元できない。
 */
export function useFermentationKeywords(
  api: ApiClient | null,
  fermentationIds: readonly string[],
): { keywords: JarWord[]; loading: boolean } {
  const { details, loading } = useFermentationDetails(api, fermentationIds);

  const keywords = useMemo(() => {
    // 同じ言葉が別の問いから出ることがある。瓶の中で二重に浮かべないので、
    // 先に出てきたほうの問いを出どころとして憶える（Map が重複を弾く）。
    const byWord = new Map<string, JarWord>();
    for (const detail of details.values()) {
      for (const keyword of detail.keywords) {
        const word = keyword.keyword;
        if (word.length === 0 || byWord.has(word)) continue;
        byWord.set(word, { word, questionId: detail.questionId });
      }
    }
    return [...byWord.values()];
  }, [details]);

  return { keywords, loading };
}
