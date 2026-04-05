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
    <div className="flex flex-col gap-6">
      <QuestionCreateForm onSubmit={createQuestion} />

      {loading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
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
  );
}
