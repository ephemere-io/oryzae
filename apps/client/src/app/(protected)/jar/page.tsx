'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { JarView } from '@/features/fermentation/components/jar-view';

interface QuestionData {
  id: string;
  currentText: string | null;
}

export default function JarPage() {
  const { api, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<QuestionData[]>([]);

  useEffect(() => {
    if (authLoading || !api) return;
    api.fetch('/api/v1/questions').then(async (res) => {
      if (res.ok) {
        setQuestions(await res.json());
      }
    });
  }, [api, authLoading]);

  return (
    <div className="-mx-4 -my-6 h-[calc(100vh-0px)]">
      <JarView api={api} authLoading={authLoading} questions={questions} />
    </div>
  );
}
