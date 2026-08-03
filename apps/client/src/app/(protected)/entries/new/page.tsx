'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { DeviceView } from '@/components/device-view';
import { EntryEditor } from '@/features/pc/entries/components/entry-editor';
import {
  useActiveQuestions,
  useLinkEntryQuestion,
} from '@/features/shared/entry-questions/hooks/use-entry-questions';
import { SpEntryEditor } from '@/features/sp/entries/components/sp-entry-editor';
import { useAuth } from '@/lib/auth-context';

export default function NewEntryPage() {
  const { api, auth, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionIdParam = searchParams.get('questionId');

  // Passing questionIdParam as refetchKey ensures the active-questions list refreshes
  // when this page is already mounted and the URL changes (e.g. onboarding adds a question
  // and redirects with ?questionId=...).
  const activeQuestions = useActiveQuestions(api, loading, questionIdParam ?? undefined);
  const linkQuestion = useLinkEntryQuestion(api);

  // Pre-link question from query param (e.g. /entries/new?questionId=xxx)
  const initialLinkedIds = useMemo(
    () => (questionIdParam ? [questionIdParam] : []),
    [questionIdParam],
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
          onLinkQuestion={linkQuestion}
          onPickled={() => router.push('/jar?justPickled=1')}
        />
      }
    />
  );
}
