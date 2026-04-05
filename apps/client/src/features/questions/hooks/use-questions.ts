'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface QuestionItem {
  id: string;
  currentText: string | null;
  isArchived: boolean;
  isProposedByOryzae: boolean;
  isValidatedByUser: boolean;
}

export function useQuestions(api: ApiClient | null, authLoading: boolean) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    const res = await api.api.v1.questions.all.$get();
    if (res.ok) {
      const data: QuestionItem[] = await res.json();
      setQuestions(data);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (!authLoading && api) {
      fetchQuestions();
    }
  }, [authLoading, api, fetchQuestions]);

  const createQuestion = useCallback(
    async (text: string) => {
      if (!api || !text.trim()) return;
      await api.api.v1.questions.$post({ json: { string: text } });
      await fetchQuestions();
    },
    [api, fetchQuestions],
  );

  return { questions, loading, createQuestion, fetchQuestions };
}
