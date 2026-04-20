'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface Snippet {
  id: string;
  snippetType: 'new_perspective' | 'deepen' | 'core';
  originalText: string;
  sourceDate: string;
  selectionReason: string;
}

interface KeywordItem {
  id: string;
  keyword: string;
  description: string;
}

interface LetterItem {
  id: string;
  bodyText: string;
}

interface Worksheet {
  id: string;
  worksheetMarkdown: string;
  resultDiagramMarkdown: string;
}

export interface FermentationDetail {
  id: string;
  questionId: string;
  targetPeriod: string;
  status: string;
  worksheet: Worksheet | null;
  snippets: Snippet[];
  letter: LetterItem | null;
  keywords: KeywordItem[];
}

interface FermentationSummary {
  id: string;
  questionId: string;
  status: string;
  createdAt: string;
}

export function useFermentationForQuestion(api: ApiClient | null, questionId: string | undefined) {
  const [results, setResults] = useState<FermentationSummary[]>([]);
  const [detail, setDetail] = useState<FermentationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    if (!api || !questionId) return;
    setLoading(true);
    const res = await api.fetch(`/api/v1/fermentations?questionId=${questionId}`);
    if (res.ok) {
      const data: FermentationSummary[] = await res.json();
      setResults(data);
      // Load the latest completed result's detail
      const completed = data.find((r) => r.status === 'completed');
      if (completed) {
        const detailRes = await api.fetch(`/api/v1/fermentations/${completed.id}`);
        if (detailRes.ok) {
          setDetail(await detailRes.json());
        }
      }
    }
    setLoading(false);
  }, [api, questionId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { results, detail, loading };
}
