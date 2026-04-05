'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { QuestionCreateForm } from '@/features/questions/components/question-create-form';
import { QuestionTimeline } from '@/features/questions/components/question-timeline';
import { useQuestions } from '@/features/questions/hooks/use-questions';

export default function QuestionsPage() {
  const { api, loading: authLoading } = useAuth();
  const {
    questions,
    loading,
    createQuestion,
    archiveQuestion,
    unarchiveQuestion,
    acceptQuestion,
    rejectQuestion,
  } = useQuestions(api, authLoading);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1">
        <div className="flex flex-col gap-6">
          <QuestionCreateForm onSubmit={createQuestion} />

          {loading ? (
            <p className="text-sm text-[var(--date-color)]">読み込み中...</p>
          ) : (
            <QuestionTimeline
              questions={questions}
              onArchive={archiveQuestion}
              onUnarchive={unarchiveQuestion}
              onAccept={acceptQuestion}
              onReject={rejectQuestion}
            />
          )}
        </div>
      </div>

      {/* Footer matching reference UI */}
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg)] px-4 py-1.5 text-xs text-[var(--date-color)]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--date-color)] opacity-30" />
          <span>問い一覧</span>
        </div>
      </footer>
    </div>
  );
}
