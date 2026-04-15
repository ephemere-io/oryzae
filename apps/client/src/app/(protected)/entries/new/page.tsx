'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryEditor } from '@/features/entries/components/entry-editor';
import { useSaveTransition } from '@/features/entries/hooks/use-save-transition';
import { useActiveQuestions } from '@/features/entry-questions/hooks/use-entry-questions';

export default function NewEntryPage() {
  const { api, auth, loading } = useAuth();
  const activeQuestions = useActiveQuestions(api, loading);
  const runTransition = useSaveTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-link question from query param (e.g. /entries/new?questionId=xxx)
  const initialLinkedIds = useMemo(() => {
    const qId = searchParams.get('questionId');
    return qId ? [qId] : [];
  }, [searchParams]);

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
