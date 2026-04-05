'use client';

import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { QuestionCard } from '@/features/questions/components/question-card';
import { useQuestions } from '@/features/questions/hooks/use-questions';

export default function QuestionsPage() {
  const { api, loading: authLoading } = useAuth();
  const { questions, loading, createQuestion, fetchQuestions } = useQuestions(api, authLoading);
  const [newQuestion, setNewQuestion] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setCreating(true);
    await createQuestion(newQuestion);
    setNewQuestion('');
    setCreating(false);
  }

  const active = questions.filter((q) => !q.isArchived && q.isValidatedByUser);
  const pending = questions.filter((q) => q.isProposedByOryzae && !q.isValidatedByUser);
  const archived = questions.filter((q) => q.isArchived);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">質問</h1>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="新しい質問を追加..."
          maxLength={64}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={creating || !newQuestion.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          追加
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-amber-600">提案中</h2>
              {pending.map((q) => (
                <QuestionCard
                  key={q.id}
                  id={q.id}
                  text={q.currentText ?? ''}
                  isArchived={q.isArchived}
                  isProposedByOryzae={q.isProposedByOryzae}
                  isValidatedByUser={q.isValidatedByUser}
                  api={api!}
                  onUpdate={fetchQuestions}
                />
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">アクティブ</h2>
            {active.length === 0 ? (
              <p className="text-sm text-zinc-500">アクティブな質問はありません</p>
            ) : (
              active.map((q) => (
                <QuestionCard
                  key={q.id}
                  id={q.id}
                  text={q.currentText ?? ''}
                  isArchived={q.isArchived}
                  isProposedByOryzae={q.isProposedByOryzae}
                  isValidatedByUser={q.isValidatedByUser}
                  api={api!}
                  onUpdate={fetchQuestions}
                />
              ))
            )}
          </section>

          {archived.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-zinc-400">アーカイブ</h2>
              {archived.map((q) => (
                <QuestionCard
                  key={q.id}
                  id={q.id}
                  text={q.currentText ?? ''}
                  isArchived={q.isArchived}
                  isProposedByOryzae={q.isProposedByOryzae}
                  isValidatedByUser={q.isValidatedByUser}
                  api={api!}
                  onUpdate={fetchQuestions}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
