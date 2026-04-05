'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface QuestionItem {
  id: string;
  currentText: string | null;
  isArchived: boolean;
  isProposedByOryzae: boolean;
  isValidatedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useQuestions(api: ApiClient | null, authLoading: boolean) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuestions = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    const res = await api.fetch('/api/v1/questions/all');
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
      await api.fetch('/api/v1/questions', {
        method: 'POST',
        body: JSON.stringify({ string: text }),
      });
      await fetchQuestions();
    },
    [api, fetchQuestions],
  );

  const editQuestion = useCallback(
    async (id: string, text: string) => {
      if (!api || !text.trim()) return;
      await api.fetch(`/api/v1/questions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ string: text }),
      });
      await fetchQuestions();
    },
    [api, fetchQuestions],
  );

  const archiveQuestion = useCallback(
    async (id: string) => {
      if (!api) return;
      await api.fetch(`/api/v1/questions/${id}/archive`, { method: 'POST' });
      await fetchQuestions();
    },
    [api, fetchQuestions],
  );

  const unarchiveQuestion = useCallback(
    async (id: string) => {
      if (!api) return;
      await api.fetch(`/api/v1/questions/${id}/unarchive`, { method: 'POST' });
      await fetchQuestions();
    },
    [api, fetchQuestions],
  );

  const acceptQuestion = useCallback(
    async (id: string) => {
      if (!api) return;
      await api.fetch(`/api/v1/questions/${id}/accept`, { method: 'POST' });
      await fetchQuestions();
    },
    [api, fetchQuestions],
  );

  const rejectQuestion = useCallback(
    async (id: string) => {
      if (!api) return;
      await api.fetch(`/api/v1/questions/${id}/reject`, { method: 'POST' });
      await fetchQuestions();
    },
    [api, fetchQuestions],
  );

  return {
    questions,
    loading,
    createQuestion,
    editQuestion,
    archiveQuestion,
    unarchiveQuestion,
    acceptQuestion,
    rejectQuestion,
    fetchQuestions,
  };
}
