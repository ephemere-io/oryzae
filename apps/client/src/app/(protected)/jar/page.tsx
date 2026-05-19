'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { JarView } from '@/features/fermentation/components/jar-view';
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

  return (
    <div className="absolute inset-0">
      <JarView
        api={api}
        authLoading={authLoading}
        questions={questions}
        readiness={readiness?.totalReadiness ?? 0}
        onAddQuestion={handleAddQuestion}
        onEditQuestion={handleEditQuestion}
        onArchiveQuestion={handleArchiveQuestion}
      />
    </div>
  );
}
