'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { JarView } from '@/features/fermentation/components/jar-view';
import { PickleSuccessModal } from '@/features/fermentation/components/pickle-success-modal';
import { useFermentationReadiness } from '@/features/fermentation/hooks/use-fermentation-readiness';
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
  // issue #278: 発酵瓶アニメーション用の集計 readiness。
  // 問い追加/編集/archive 後にも refresh して、エントリ追加直後の反映と
  // 質問構成変化を即座に演出に乗せる。
  const { readiness, refresh: refreshReadiness } = useFermentationReadiness(api, authLoading);
  // issue #278 デバッグ用: スライダーで readiness を手動上書きできる。
  // null のとき API 値を使い、数値が入っていればそれを JarView に渡す。本番 deploy 前に外す。
  const [debugReadinessOverride, setDebugReadinessOverride] = useState<number | null>(null);
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

  // issue #278 デバッグ用: readiness 値の遷移を console に出す。UI に数値を露出しない
  // 設計上、開発者が瓶の演出と数値の対応を確認するための唯一の経路。
  useEffect(() => {
    if (readiness) {
      console.log('[jar] fermentation readiness', readiness);
    }
  }, [readiness]);

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
    await refreshReadiness();
  }

  async function handleEditQuestion(id: string, text: string) {
    await editQuestion(id, text);
    await fetchActiveQuestions();
    await refreshReadiness();
  }

  async function handleArchiveQuestion(id: string) {
    await archiveQuestion(id);
    await fetchActiveQuestions();
    await refreshReadiness();
  }

  const effectiveReadiness = debugReadinessOverride ?? readiness?.totalReadiness ?? 0;

  return (
    <div className="absolute inset-0">
      <JarView
        api={api}
        authLoading={authLoading}
        questions={questions}
        readiness={effectiveReadiness}
        onAddQuestion={handleAddQuestion}
        onEditQuestion={handleEditQuestion}
        onArchiveQuestion={handleArchiveQuestion}
      />
      <PickleSuccessModal open={pickleSuccessOpen} onClose={() => setPickleSuccessOpen(false)} />
      {/* issue #278 デバッグ用: readiness を 0.0–3.0 で手動上書き。本番 deploy 前に削除する。 */}
      <div
        className="absolute top-3 right-3 z-[200] flex flex-col gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)]/90 px-3 py-2 text-[11px] text-[var(--fg)] shadow-md backdrop-blur"
        style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
      >
        <div className="flex items-center justify-between gap-3">
          <span>debug: readiness</span>
          <span className="tabular-nums">{effectiveReadiness.toFixed(2)}</span>
        </div>
        <input
          aria-label="readiness override slider"
          type="range"
          min={0}
          max={3}
          step={0.05}
          value={debugReadinessOverride ?? readiness?.totalReadiness ?? 0}
          onChange={(e) => setDebugReadinessOverride(Number(e.target.value))}
          className="w-48"
        />
        <button
          type="button"
          onClick={() => setDebugReadinessOverride(null)}
          className="self-end text-[10px] text-[var(--date-color)] underline hover:text-[var(--fg)]"
        >
          reset (API 値に戻す)
        </button>
      </div>
    </div>
  );
}
