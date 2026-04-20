'use client';

import { useCallback, useEffect, useState } from 'react';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface WorksheetData {
  id: string;
  fermentationResultId: string;
  worksheetMarkdown: string;
  resultDiagramMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnippetData {
  id: string;
  fermentationResultId: string;
  snippetType: 'new_perspective' | 'deepen' | 'core';
  originalText: string;
  sourceDate: string;
  selectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface LetterData {
  id: string;
  fermentationResultId: string;
  bodyText: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeywordData {
  id: string;
  fermentationResultId: string;
  keyword: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScannedEntryData {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface FermentationDetailResponse {
  id: string;
  userId: string;
  questionId: string;
  targetPeriod: string;
  status: string;
  generationId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  userEmail: string;
  questionText: string;
  cost: unknown;
  masked: boolean;
  worksheet: WorksheetData | null;
  snippets: SnippetData[];
  letter: LetterData | null;
  keywords: KeywordData[];
  scannedEntries: ScannedEntryData[];
}

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
    if (res.ok) {
      const json = (await res.json()) as FermentationDetailResponse;
      setData(json);
    } else {
      setError('発酵詳細の取得に失敗しました');
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
