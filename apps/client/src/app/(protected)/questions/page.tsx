'use client';

import { DeviceView } from '@/components/device-view';
import { QuestionCreateForm } from '@/features/pc/questions/components/question-create-form';
import { QuestionTimeline } from '@/features/pc/questions/components/question-timeline';
import { useQuestions } from '@/features/pc/questions/hooks/use-questions';
import { useAuth } from '@/features/shared/auth/hooks/use-auth';

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
    <DeviceView
      pc={
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
      }
    />
  );
}
