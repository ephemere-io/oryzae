'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryEditor } from '@/features/entries/components/entry-editor';
import { useSaveTransition } from '@/features/entries/hooks/use-save-transition';
import { useActiveQuestions } from '@/features/entry-questions/hooks/use-entry-questions';
import { useOnboarding } from '@/features/onboarding/hooks/use-onboarding';

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
  // Issue #314 follow-up: when a brand-new user lands here from the email confirmation
  // link, the protected layout shows the onboarding modal alongside this page. We must
  // not surface the question-required modal in that case — onboarding will provide
  // the first question itself, and stacking two modals confuses the user.
  const { shouldShow: onboardingActive, loading: onboardingLoading } = useOnboarding(api);

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

  /**
   * Issue #314: inline question creation from the question-required modal.
   * Returns the created option so EntryEditor can show + link it without a full refetch.
   */
  async function handleCreateQuestion(text: string) {
    if (!api) return null;
    const res = await api.fetch('/api/v1/questions', {
      method: 'POST',
      body: JSON.stringify({ string: text }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id: string };
    return { id: data.id, currentText: text };
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
      onCreateQuestion={handleCreateQuestion}
      onSaveTransition={handleSaveTransition}
      // Issue #314: every time entry/new opens with no preselected question, force the
      // question prompt. The onboarding hand-off uses ?questionId=... and skips the modal.
      // Also suppress while onboarding is still active (or its status is still being
      // fetched) — onboarding handles the first question and we don't want to stack
      // modals on the very first session.
      forceQuestionPrompt={initialLinkedIds.length === 0 && !onboardingLoading && !onboardingActive}
    />
  );
}
