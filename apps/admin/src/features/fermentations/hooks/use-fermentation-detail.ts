'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { parseJson } from '@/lib/json';

const worksheetDataSchema = z.object({
  id: z.string(),
  fermentationResultId: z.string(),
  worksheetMarkdown: z.string(),
  resultDiagramMarkdown: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const snippetDataSchema = z.object({
  id: z.string(),
  fermentationResultId: z.string(),
  snippetType: z.enum(['new_perspective', 'deepen', 'core']),
  originalText: z.string(),
  sourceDate: z.string(),
  selectionReason: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const letterDataSchema = z.object({
  id: z.string(),
  fermentationResultId: z.string(),
  bodyText: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const keywordDataSchema = z.object({
  id: z.string(),
  fermentationResultId: z.string(),
  keyword: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const scannedEntryDataSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const fermentationDetailResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  questionId: z.string(),
  targetPeriod: z.string(),
  status: z.string(),
  generationId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  userEmail: z.string(),
  questionText: z.string(),
  // サーバー側は computeCostFromTokens の TokenCost か、AI gateway の
  // getGenerationInfo の戻り値のどちらかを入れる（異種混在）。形を決め打ちすると
  // 片方で parse に失敗して詳細画面ごと出せなくなるので unknown のまま受け、
  // 表示側の formatCost が実行時に絞る。
  // なお Zod v3 は unknown のキーを必ず optional として推論する（required にできない）。
  cost: z.unknown(),
  masked: z.boolean(),
  worksheet: worksheetDataSchema.nullable(),
  snippets: z.array(snippetDataSchema),
  letter: letterDataSchema.nullable(),
  keywords: z.array(keywordDataSchema),
  scannedEntries: z.array(scannedEntryDataSchema),
});

export type WorksheetData = z.infer<typeof worksheetDataSchema>;
export type SnippetData = z.infer<typeof snippetDataSchema>;
export type LetterData = z.infer<typeof letterDataSchema>;
export type KeywordData = z.infer<typeof keywordDataSchema>;
export type ScannedEntryData = z.infer<typeof scannedEntryDataSchema>;
export type FermentationDetailResponse = z.infer<typeof fermentationDetailResponseSchema>;

export function useFermentationDetail(id: string) {
  const [data, setData] = useState<FermentationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/fermentations/${id}`);
    if (!res.ok) {
      setError('発酵詳細の取得に失敗しました');
    } else {
      const json = await parseJson(res, fermentationDetailResponseSchema);
      if (json) setData(json);
      else setError('発酵詳細の応答形式が不正です（API の変更を確認してください）');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const retryFermentation = useCallback(async (): Promise<boolean> => {
    const token = getAccessToken();
    if (!token) return false;

    const api = createApiClient(token);
    const res = await api.fetch(`/api/v1/admin/fermentations/${id}/retry`, { method: 'POST' });
    if (res.ok) {
      await fetchDetail();
      return true;
    }
    return false;
  }, [id, fetchDetail]);

  return { data, loading, error, refresh: fetchDetail, retryFermentation };
}
