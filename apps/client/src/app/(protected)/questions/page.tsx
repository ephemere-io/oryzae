'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { QuestionCreateForm } from '@/features/questions/components/question-create-form';
import { QuestionTimeline } from '@/features/questions/components/question-timeline';
import { useQuestions } from '@/features/questions/hooks/use-questions';

export default function QuestionsPage() {
  const { api } = useAuth();
  const {
    questions,
    loading,
    createQuestion,
    archiveQuestion,
    unarchiveQuestion,
    acceptQuestion,
    rejectQuestion,
  } = useQuestions(api);

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-[800px] flex-1 px-6 pt-6 pb-20">
        <QuestionCreateForm onSubmit={createQuestion} />

        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col gap-4" data-testid="questions-skeleton">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
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
    </div>
  );
}
