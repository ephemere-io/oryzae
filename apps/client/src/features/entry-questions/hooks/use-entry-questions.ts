'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface LinkedQuestion {
  id: string;
  currentText: string | null;
}

/**
 * @param refetchKey Optional value that, when changed, forces a re-fetch.
 *   Used by NewEntryPage to refresh after onboarding adds a new question
 *   while the page is already mounted (URL changes but the page does not remount).
 */
export function useActiveQuestions(
  api: ApiClient | null,
  authLoading: boolean,
  refetchKey?: string,
) {
  const [activeQuestions, setActiveQuestions] = useState<LinkedQuestion[]>([]);

  useEffect(() => {
    if (authLoading || !api) return;
    let cancelled = false;

    // refetchKey is appended as a no-op query so that changing it (e.g. ?questionId=...)
    // both forces this effect to re-run AND defeats any incidental HTTP cache.
    const url = refetchKey
      ? `/api/v1/questions?refetchKey=${encodeURIComponent(refetchKey)}`
      : '/api/v1/questions';

    api.fetch(url).then(async (res) => {
      if (cancelled) return;
      if (res.ok) {
        const data: LinkedQuestion[] = await res.json();
        if (!cancelled) setActiveQuestions(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [api, authLoading, refetchKey]);

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
