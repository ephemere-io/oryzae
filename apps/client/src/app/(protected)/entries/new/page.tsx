'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryEditor } from '@/features/entries/components/entry-editor';
import { useSaveTransition } from '@/features/entries/hooks/use-save-transition';
import { useActiveQuestions } from '@/features/entry-questions/hooks/use-entry-questions';

export default function NewEntryPage() {
  const { api, auth, loading } = useAuth();
  const runTransition = useSaveTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionIdParam = searchParams.get('questionId');

  // Passing questionIdParam as refetchKey ensures the active-questions list refreshes
  // when this page is already mounted and the URL changes (e.g. onboarding adds a question
  // and redirects with ?questionId=...).
  const activeQuestions = useActiveQuestions(api, loading, questionIdParam ?? undefined);

  // Pre-link question from query param (e.g. /entries/new?questionId=xxx)
  const initialLinkedIds = useMemo(
    () => (questionIdParam ? [questionIdParam] : []),
    [questionIdParam],
  );

  async function handleLinkQuestion(entryId: string, questionId: string) {
    if (!api) return;
    await api.fetch(`/api/v1/entries/${entryId}/questions/${questionId}`, {
      method: 'POST',
    });
  }

  const handleSaveTransition = useCallback(
    async (text: string, editorEl: HTMLElement) => {
      await runTransition(text, editorEl);
      router.push('/jar');
    },
    [runTransition, router],
  );

  return (
    <EntryEditor
      api={api}
      auth={auth}
      activeQuestions={activeQuestions}
      initialLinkedIds={initialLinkedIds}
      onLinkQuestion={handleLinkQuestion}
      onSaveTransition={handleSaveTransition}
    />
  );
}
