'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { DeviceView } from '@/components/device-view';
import { EntryEditor } from '@/features/pc/entries/components/entry-editor';
import { useEntry } from '@/features/shared/entries/hooks/use-entry';
import {
  useActiveQuestions,
  useEntryQuestions,
} from '@/features/shared/entry-questions/hooks/use-entry-questions';
import { useFirstLetter } from '@/features/shared/fermentation/hooks/use-first-letter';
import { SpEntryEditor } from '@/features/sp/entries/components/sp-entry-editor';
import { useAuth } from '@/lib/auth-context';
import { useUnread } from '@/lib/unread-context';
import { EntryEditorRouteLoading } from '../../_loading/entry-editor-route-loading';

export default function EntryDetailPage() {
  const t = useTranslations('entries.detail');
  const params = useParams<{ id: string }>();
  const { api, auth, loading: authLoading } = useAuth();
  const { entry, loading: entryLoading } = useEntry(params.id, api, authLoading);
  const activeQuestions = useActiveQuestions(api, authLoading);
  const { linkedQuestions, linkQuestion, unlinkQuestion } = useEntryQuestions(api, params.id);
  const router = useRouter();
  const { requestFirstLetter } = useFirstLetter(api);
  const { refresh: refreshUnread } = useUnread();

  // SP は納めたあとも編集画面に留まるので、初めての手紙はここから頼む（new/page と同じ）。
  // PC は /jar?justPickled=1 へ遷移し、瓶の page が頼む。
  const handleSpPickled = useCallback(() => {
    void requestFirstLetter().then(({ fired }) => {
      if (fired) void refreshUnread();
    });
  }, [requestFirstLetter, refreshUnread]);

  // 本文の取得中もロード表示を出し続ける（null だと枠が一度消えて真っ白になる）。
  if (entryLoading || authLoading) return <EntryEditorRouteLoading existing />;

  if (!entry) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-sm text-[var(--date-color)]">{t('not_found')}</p>
      </div>
    );
  }

  return (
    <DeviceView
      sp={
        <SpEntryEditor
          api={api}
          initialEntryId={entry.id}
          initialContent={entry.content}
          initialMediaUrls={entry.mediaUrls}
          initialMediaSignedUrls={entry.mediaSignedUrls}
          onPickled={handleSpPickled}
        />
      }
      pc={
        <EntryEditor
          entryId={entry.id}
          initialContent={entry.content}
          initialEffects={entry.effects}
          initialMediaUrls={entry.mediaUrls}
          initialMediaSignedUrls={entry.mediaSignedUrls}
          createdAt={entry.createdAt}
          updatedAt={entry.updatedAt}
          api={api}
          auth={auth}
          activeQuestions={activeQuestions}
          initialLinkedIds={linkedQuestions.map((q) => q.id)}
          onLinkQuestion={async (_entryId, questionId) => linkQuestion(questionId)}
          onUnlinkQuestion={async (_entryId, questionId) => unlinkQuestion(questionId)}
          // 新規（new/page）と同じ印を付けて瓶へ。瓶の page がこれを見て、漬け込みの
          // 演出と「初めての手紙」の依頼をする（既存のエントリーを初めて漬ける人もいる）。
          onPickled={() => router.push('/jar?justPickled=1')}
        />
      }
    />
  );
}
