'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { JarView } from '@/features/fermentation/components/jar-view';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { useUnread } from '@/lib/unread-context';

interface QuestionData {
  id: string;
  currentText: string | null;
}

export default function JarPage() {
  const { api, loading: authLoading } = useAuth();
  const { createQuestion, editQuestion, archiveQuestion } = useQuestions(api, authLoading);
  const { markSeen } = useUnread();
  const [questions, setQuestions] = useState<QuestionData[]>([]);

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
    </div>
  );
}
