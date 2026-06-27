'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { DeviceView } from '@/components/device-view';
import { EntryEditor } from '@/features/pc/entries/components/entry-editor';
import { useSaveTransition } from '@/features/pc/entries/hooks/use-save-transition';
import { useAuth } from '@/features/shared/auth/hooks/use-auth';
import { useActiveQuestions } from '@/features/shared/entry-questions/hooks/use-entry-questions';
import { SpEntryEditor } from '@/features/sp/entries/components/sp-entry-editor';

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
      router.push('/jar?justPickled=1');
    },
    [runTransition, router],
  );

  // 端末で出し分け（URL は /entries/new のまま）。DeviceView が判定前/未対応を安全に処理。
  return (
    <DeviceView
      sp={<SpEntryEditor api={api} initialQuestionId={questionIdParam} />}
      pc={
        <EntryEditor
          api={api}
          auth={auth}
          activeQuestions={activeQuestions}
          initialLinkedIds={initialLinkedIds}
          onLinkQuestion={handleLinkQuestion}
          onSaveTransition={handleSaveTransition}
        />
      }
    />
  );
}
