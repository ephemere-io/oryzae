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
      <div className="mx-auto w-full max-w-[800px] flex-1 px-6 pt-6 pb-20">
        <QuestionCreateForm onSubmit={createQuestion} />

        <div className="mt-6">
          {loading ? null : (
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
    </div>
  );
}
