'use client';

import { useCallback, useEffect, useState } from 'react';
import { normalizeLinkedQuestions } from '@/features/shared/entry-questions/normalize';
import type { LinkedQuestion } from '@/features/shared/entry-questions/types';
import type { ApiClient } from '@/lib/api';

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

    // 失敗は握って空のままにする（問いの選択肢は補助情報で、取れなくても書き始められる）。
    // catch が無いと useEffect 内の未処理 rejection になっていた。
    api
      .fetch(url)
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const data: unknown = await res.json();
        if (!cancelled) setActiveQuestions(normalizeLinkedQuestions(data));
      })
      .catch(() => {});

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
    try {
      const res = await api.fetch(`/api/v1/entries/${entryId}/questions`);
      if (!res.ok) return;
      const data: unknown = await res.json();
      setLinkedQuestions(normalizeLinkedQuestions(data));
    } catch {
      // 紐付け済みの問いが取れなくてもエディタは使える。既存の表示を保つ。
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

/**
 * 保存後に確定する entryId へ問いを紐づける（端末非依存）。
 *
 * `useEntryQuestions` は entryId を hook 生成時に束縛するため、新規作成のように
 * 「保存して初めて id が決まる」経路では使えない。Issue #490 ではそれが理由で
 * `app/(protected)/entries/new/page.tsx` が POST を直叩きしていた。
 */
export function useLinkEntryQuestion(api: ApiClient | null) {
  return useCallback(
    async (entryId: string, questionId: string): Promise<void> => {
      if (!api) return;
      await api.fetch(`/api/v1/entries/${entryId}/questions/${questionId}`, { method: 'POST' });
    },
    [api],
  );
}
