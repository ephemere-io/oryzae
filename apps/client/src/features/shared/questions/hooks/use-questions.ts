'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QuestionItem } from '@/features/shared/questions/types';
import type { ApiClient } from '@/lib/api';

export function useQuestions(api: ApiClient | null) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Issue #357: 取得失敗を error ステートとして surface する。
  const [error, setError] = useState<boolean>(false);

  const fetchQuestions = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(false);
    try {
      const res = await api.fetch('/api/v1/questions/all');
      if (res.ok) {
        const data: QuestionItem[] = await res.json();
        setQuestions(data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [api]);

  // Issue #362: auth/me の完了（authLoading）を待たず、api が用意でき次第すぐ取得する。
  // api は useAuth が stored token から楽観的に即生成する。失効時は createApiClient が
  // 401→refresh→retry で自己修復する。
  useEffect(() => {
    if (api) {
      fetchQuestions();
    }
  }, [api, fetchQuestions]);

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
    error,
    createQuestion,
    editQuestion,
    archiveQuestion,
    unarchiveQuestion,
    acceptQuestion,
    rejectQuestion,
    fetchQuestions,
  };
}
