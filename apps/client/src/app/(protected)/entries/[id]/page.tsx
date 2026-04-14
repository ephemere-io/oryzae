'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryEditor } from '@/features/entries/components/entry-editor';
import { useEntry } from '@/features/entries/hooks/use-entry';
import { useSaveTransition } from '@/features/entries/hooks/use-save-transition';
import {
  useActiveQuestions,
  useEntryQuestions,
} from '@/features/entry-questions/hooks/use-entry-questions';

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  const { api, auth, loading: authLoading } = useAuth();
  const { entry, loading: entryLoading } = useEntry(params.id, api, authLoading);
  const activeQuestions = useActiveQuestions(api, authLoading);
  const { linkedQuestions, linkQuestion, unlinkQuestion } = useEntryQuestions(api, params.id);
  const runTransition = useSaveTransition();
  const router = useRouter();

  const handleSaveTransition = useCallback(
    async (text: string, editorEl: HTMLElement) => {
      await runTransition(text, editorEl);
      router.push('/jar');
    },
    [runTransition, router],
  );

  if (entryLoading || authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-[var(--date-color)]">読み込み中...</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-[var(--date-color)]">エントリが見つかりません</p>
      </div>
    );
  }

  return (
    <EntryEditor
      entryId={entry.id}
      initialContent={entry.content}
      api={api}
      auth={auth}
      activeQuestions={activeQuestions}
      initialLinkedIds={linkedQuestions.map((q) => q.id)}
      onLinkQuestion={async (_entryId, questionId) => linkQuestion(questionId)}
      onUnlinkQuestion={async (_entryId, questionId) => unlinkQuestion(questionId)}
      onSaveTransition={handleSaveTransition}
    />
  );
}
