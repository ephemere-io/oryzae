'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DeviceView } from '@/components/device-view';
import { JarView } from '@/features/pc/fermentation/components/jar-view';
import { PickleSuccessModal } from '@/features/pc/fermentation/components/pickle-success-modal';
import { useFermentationReadiness } from '@/features/shared/fermentation/hooks/use-fermentation-readiness';
import { useJarQuestions } from '@/features/shared/questions/hooks/use-jar-questions';
import { useQuestions } from '@/features/shared/questions/hooks/use-questions';
import { SpJar } from '@/features/sp/fermentation/components/sp-jar';
import { useAuth } from '@/lib/auth-context';

export default function JarPage() {
  const { api, loading: authLoading } = useAuth();
  const { createQuestion, editQuestion, archiveQuestion } = useQuestions(api);
  const { questions, refetch: refetchQuestions } = useJarQuestions(api, authLoading);
  // issue #278: 瓶の見た目に反映する readiness（問いごとの readiness の総和, 0〜3）。
  // サーバーがリクエストのたびに評価し直すので、漬け込み後にこのページへ来れば最新になる。
  const { data: readiness } = useFermentationReadiness(api, authLoading);
  const router = useRouter();
  const searchParams = useSearchParams();
  const justPickled = searchParams.get('justPickled') === '1';
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
      sp={<SpJar api={api} />}
      pc={
        <div className="absolute inset-0">
          <JarView
            api={api}
            authLoading={authLoading}
            questions={questions}
            readiness={readiness?.score ?? 0}
            onAddQuestion={handleAddQuestion}
            onEditQuestion={handleEditQuestion}
            onArchiveQuestion={handleArchiveQuestion}
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
