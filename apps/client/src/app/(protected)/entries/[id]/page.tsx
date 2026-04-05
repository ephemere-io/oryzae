'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { EntryEditor } from '@/features/entries/components/entry-editor';
import { useEntry } from '@/features/entries/hooks/use-entry';
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

  if (entryLoading || authLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-zinc-500">読み込み中...</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-zinc-500">エントリが見つかりません</p>
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
    />
  );
}
