'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { DeviceView } from '@/components/device-view';
import { EntryEditor } from '@/features/pc/entries/components/entry-editor';
import {
  useActiveQuestions,
  useLinkEntryQuestion,
} from '@/features/shared/entry-questions/hooks/use-entry-questions';
import { useFirstLetter } from '@/features/shared/fermentation/hooks/use-first-letter';
import { SpEntryEditor } from '@/features/sp/entries/components/sp-entry-editor';
import { useAuth } from '@/lib/auth-context';
import { useUnread } from '@/lib/unread-context';

export default function NewEntryPage() {
  const { api, auth, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionIdParam = searchParams.get('questionId');
  const { requestFirstLetter } = useFirstLetter(api);
  const { refresh: refreshUnread } = useUnread();

  // SP は納めたあとも編集画面に留まる（自動遷移を持たない）ので、初めての手紙はここから
  // 頼む。届いたら未読を取り直し、瓶に着いたときに印が出ているようにする。
  // PC は /jar?justPickled=1 へ遷移し、瓶の page が同じことをする。
  const handleSpPickled = useCallback(() => {
    void requestFirstLetter().then(({ fired }) => {
      if (fired) void refreshUnread();
    });
  }, [requestFirstLetter, refreshUnread]);

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
      sp={
        <SpEntryEditor api={api} initialQuestionId={questionIdParam} onPickled={handleSpPickled} />
      }
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
