'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { JarView } from '@/features/fermentation/components/jar-view';
import { PickleSuccessModal } from '@/features/fermentation/components/pickle-success-modal';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { useUnread } from '@/lib/unread-context';

interface QuestionData {
  id: string;
  currentText: string | null;
  /** Jar view position (0-100, percent of the JarView viewport). null → fall back. */
  jarX: number | null;
  jarY: number | null;
}

export default function JarPage() {
  const { api, loading: authLoading } = useAuth();
  const { createQuestion, editQuestion, archiveQuestion } = useQuestions(api, authLoading);
  const { markSeen } = useUnread();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
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

  const fetchActiveQuestions = useCallback(async () => {
    if (!api) return;
    const res = await api.fetch('/api/v1/questions');
    if (res.ok) {
      setQuestions(await res.json());
    }
  }, [api]);

  // Mark fermentation results as seen when visiting jar page
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  useEffect(() => {
    if (authLoading) return;
    fetchActiveQuestions();
  }, [authLoading, fetchActiveQuestions]);

  async function handleAddQuestion(text: string) {
    await createQuestion(text);
    await fetchActiveQuestions();
  }

  async function handleEditQuestion(id: string, text: string) {
    await editQuestion(id, text);
    await fetchActiveQuestions();
  }

  async function handleArchiveQuestion(id: string) {
    await archiveQuestion(id);
    await fetchActiveQuestions();
  }

  return (
    <div className="absolute inset-0">
      <JarView
        api={api}
        authLoading={authLoading}
        questions={questions}
        onAddQuestion={handleAddQuestion}
        onEditQuestion={handleEditQuestion}
        onArchiveQuestion={handleArchiveQuestion}
      />
      <PickleSuccessModal open={pickleSuccessOpen} onClose={() => setPickleSuccessOpen(false)} />
    </div>
  );
}
