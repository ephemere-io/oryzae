'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryEditor } from '@/features/entries/components/entry-editor';
import { useSaveTransition } from '@/features/entries/hooks/use-save-transition';
import { useActiveQuestions } from '@/features/entry-questions/hooks/use-entry-questions';
import { useTriggerFermentation } from '@/features/fermentation/hooks/use-trigger-fermentation';

export default function NewEntryPage() {
  const { api, auth, loading } = useAuth();
  const activeQuestions = useActiveQuestions(api, loading);
  const triggerFermentation = useTriggerFermentation(api);
  const runTransition = useSaveTransition();
  const router = useRouter();

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
      onLinkQuestion={handleLinkQuestion}
      onSaveComplete={triggerFermentation}
      onSaveTransition={handleSaveTransition}
    />
  );
}
