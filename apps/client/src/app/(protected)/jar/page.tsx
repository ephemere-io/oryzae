'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DeviceView } from '@/components/device-view';
import { JarView } from '@/features/pc/fermentation/components/jar-view';
import { PickleSuccessModal } from '@/features/pc/fermentation/components/pickle-success-modal';
import { useFermentationReadiness } from '@/features/shared/fermentation/hooks/use-fermentation-readiness';
import { useFirstLetter } from '@/features/shared/fermentation/hooks/use-first-letter';
import { useHelpMode } from '@/features/shared/help/help-context';
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
  const { unreadQuestionIds, refresh: refreshUnread } = useUnread();
  // issue #278: 瓶の見た目に反映する readiness（段階を決める top と、賑やかさを決める total）。
  // サーバーがリクエストのたびに評価し直すので、漬け込み後にこのページへ来れば最新になる。
  const { data: readiness, refresh: refreshReadiness } = useFermentationReadiness(api, authLoading);
  const { requestFirstLetter } = useFirstLetter(api);
  // ヘルプの三歩。①（問いを立てる）の間だけ、PC の空の瓶を大きく見せる。
  const help = useHelpMode();
  const router = useRouter();
  // SP はボトムナビを持たない（書斎が唯一のグローバルナビ）ので、問いの管理へは
  // 瓶から入る。ドメインをまたぐ合成なので、重ねるのは page の仕事
  // （features/sp/fermentation → features/sp/questions は reach-slice-isolation で禁止）。
  const [manageOpen, setManageOpen] = useState(false);
  const searchParams = useSearchParams();
  const justPickled = searchParams.get('justPickled') === '1';
  const [pickleSuccessOpen, setPickleSuccessOpen] = useState(false);
  const pickleTimerScheduledRef = useRef(false);
  // 漬け込み直後に「初めての手紙」を頼む番。justPickled は router.replace で直後に消える
  // ので、その事実だけを state に持ち越して api が揃ってから頼む。
  const [firstLetterPending, setFirstLetterPending] = useState(false);
  // 初めての手紙が届いたら PC の瓶を組み直す番号。JarView のデータ hook はマウント時に
  // 取るだけなので、key を進めて取り直させる（書き込み後は API client の憶えも空）。
  const [jarEpoch, setJarEpoch] = useState(0);

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
    setFirstLetterPending(true);
    router.replace('/jar');
  }, [justPickled, router]);

  // 初めての漬け込みなら、その場で手紙を頼む（初回かどうかはサーバが判定するので、
  // 漬けるたびに呼んでよい）。演出（3.5s 後のモーダル）は待たない — LLM の数十秒の方が
  // 長い。届いたら未読と readiness を取り直し、瓶を組み直して手紙を出す。ドメインを
  // またぐ合成（fermentation の手紙 × 未読の配布）なので、つなぐのは page の仕事。
  useEffect(() => {
    if (!firstLetterPending || !api) return;
    setFirstLetterPending(false);
    void requestFirstLetter().then(({ fired }) => {
      if (!fired) return;
      void refreshUnread();
      void refreshReadiness();
      setJarEpoch((n) => n + 1);
    });
  }, [firstLetterPending, api, requestFirstLetter, refreshUnread, refreshReadiness]);

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
            key={jarEpoch}
            api={api}
            authLoading={authLoading}
            questions={questions}
            readinessTop={readiness?.top ?? 0}
            readinessTotal={readiness?.total ?? 0}
            onAddQuestion={handleAddQuestion}
            onEditQuestion={handleEditQuestion}
            onArchiveQuestion={handleArchiveQuestion}
            emphasizeEmpty={help.tutorial.step === 'question'}
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
