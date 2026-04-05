'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface LinkedQuestion {
  id: string;
  currentText: string | null;
}

export function useActiveQuestions(api: ApiClient | null, authLoading: boolean) {
  const [activeQuestions, setActiveQuestions] = useState<LinkedQuestion[]>([]);

  useEffect(() => {
    if (authLoading || !api) return;

    api.fetch('/api/v1/questions').then(async (res) => {
      if (res.ok) {
        const data: LinkedQuestion[] = await res.json();
        setActiveQuestions(data);
      }
    });
  }, [api, authLoading]);

  return activeQuestions;
}

export function useEntryQuestions(api: ApiClient | null, entryId: string | undefined) {
  const [linkedQuestions, setLinkedQuestions] = useState<LinkedQuestion[]>([]);

  const fetchLinked = useCallback(async () => {
    if (!api || !entryId) return;
    const res = await api.fetch(`/api/v1/entries/${entryId}/questions`);
    if (res.ok) {
      const data: LinkedQuestion[] = await res.json();
      setLinkedQuestions(data);
    }
  }, [api, entryId]);

  useEffect(() => {
    fetchLinked();
  }, [fetchLinked]);

  const linkQuestion = useCallback(
    async (questionId: string) => {
      if (!api || !entryId) return;
      await api.fetch(`/api/v1/entries/${entryId}/questions/${questionId}`, {
        method: 'POST',
      });
      await fetchLinked();
    },
    [api, entryId, fetchLinked],
  );

  const unlinkQuestion = useCallback(
    async (questionId: string) => {
      if (!api || !entryId) return;
      await api.fetch(`/api/v1/entries/${entryId}/questions/${questionId}`, {
        method: 'DELETE',
      });
      await fetchLinked();
    },
    [api, entryId, fetchLinked],
  );

  return { linkedQuestions, linkQuestion, unlinkQuestion };
}
