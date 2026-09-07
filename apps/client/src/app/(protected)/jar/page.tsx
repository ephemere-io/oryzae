'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DeviceView } from '@/components/device-view';
import { JarView } from '@/features/pc/fermentation/components/jar-view';
import { PickleSuccessModal } from '@/features/pc/fermentation/components/pickle-success-modal';
import { useJarQuestions } from '@/features/shared/questions/hooks/use-jar-questions';
import { useQuestions } from '@/features/shared/questions/hooks/use-questions';
import { SpJar } from '@/features/sp/fermentation/components/sp-jar';
import { SpQuestions } from '@/features/sp/questions/components/sp-questions';
import { useAuth } from '@/lib/auth-context';
import { useUnread } from '@/lib/unread-context';

export default function JarPage() {
  const { api, loading: authLoading } = useAuth();
  const {
    questions: allQuestions,
    loading: allQuestionsLoading,
    createQuestion,
    editQuestion,
    archiveQuestion,
    acceptQuestion,
    rejectQuestion,
  } = useQuestions(api);
  const {
    questions,
    loading: questionsLoading,
    refetch: refetchQuestions,
  } = useJarQuestions(api, authLoading);
  const { unreadQuestionIds } = useUnread();
  const router = useRouter();
  // SP はボトムナビを持たない（書斎が唯一のグローバルナビ）ので、問いの管理へは
  // 瓶から入る。ドメインをまたぐ合成なので、重ねるのは page の仕事
  // （features/sp/fermentation → features/sp/questions は reach-slice-isolation で禁止）。
  const [manageOpen, setManageOpen] = useState(false);
  const searchParams = useSearchParams();
  const justPickled = searchParams.get('justPickled') === '1';
  /**
   * 書斎の瓶の上の封から来たとき、その手紙を開いた状態で始める（`?letter=<発酵 id>`）。
   *
   * 端末で開き方が違う（PC はサイドバー、SP は円を開いてシート）ので、URL を読むのは
   * page の仕事にして、開き方は各端末の部品に任せる。
   */
  const openLetterFor = searchParams.get('letter');
  const [pickleSuccessOpen, setPickleSuccessOpen] = useState(false);
  const pickleTimerScheduledRef = useRef(false);

  // Issue #322: 漬け込み完了モーダルをアニメーション直後の遷移時に一度だけ表示する。
  // useSaveTransition は 1.5s で resolve → /jar 遷移を行うが、その後も overlay 上で
  // condense(2-3.5s) と fade(3.5-4.3s) が走る。文字が瓶の中で透明化を終えてから
  // 表示するため、遷移後 3.5s 遅延させる。
  // router.replace で searchParams が更新されると effect が再実行されるため、
  // ref でタイマーが一度しかスケジュールされないようにガードする。
  useEffect(() => {
    if (!justPickled || pickleTimerScheduledRef.current) return;
    pickleTimerScheduledRef.current = true;
    setTimeout(() => setPickleSuccessOpen(true), 3500);
    router.replace('/jar');
  }, [justPickled, router]);

  async function handleAddQuestion(text: string) {
    await createQuestion(text);
    await refetchQuestions();
  }

  async function handleEditQuestion(id: string, text: string) {
    await editQuestion(id, text);
    await refetchQuestions();
  }

  async function handleArchiveQuestion(id: string) {
    await archiveQuestion(id);
    await refetchQuestions();
  }

  // 端末で出し分け（URL は /jar のまま）。DeviceView が判定前/未対応を安全に処理。
  return (
    <DeviceView
      sp={
        <>
          <SpJar
            api={api}
            questions={questions}
            loading={questionsLoading}
            onManageQuestions={() => setManageOpen(true)}
            openLetterFor={openLetterFor}
          />
          {manageOpen ? (
            <div className="absolute inset-0 z-40 flex flex-col bg-[var(--bg)]">
              <SpQuestions
                questions={allQuestions}
                loading={allQuestionsLoading}
                createQuestion={handleAddQuestion}
                editQuestion={handleEditQuestion}
                archiveQuestion={handleArchiveQuestion}
                acceptQuestion={acceptQuestion}
                rejectQuestion={rejectQuestion}
                unreadQuestionIds={unreadQuestionIds}
                onClose={() => setManageOpen(false)}
              />
            </div>
          ) : null}
        </>
      }
      pc={
        <div className="absolute inset-0">
          <JarView
            api={api}
            authLoading={authLoading}
            questions={questions}
            onAddQuestion={handleAddQuestion}
            onEditQuestion={handleEditQuestion}
            onArchiveQuestion={handleArchiveQuestion}
            openLetterFor={openLetterFor}
          />
          <PickleSuccessModal
            open={pickleSuccessOpen}
            onClose={() => setPickleSuccessOpen(false)}
          />
        </div>
      }
    />
  );
}
