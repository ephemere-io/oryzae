'use client';

import { useTranslations } from 'next-intl';
import { DeviceView } from '@/components/device-view';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { QuestionCreateForm } from '@/features/pc/questions/components/question-create-form';
import { QuestionTimeline } from '@/features/pc/questions/components/question-timeline';
import { useQuestions } from '@/features/shared/questions/hooks/use-questions';
import { SpQuestions } from '@/features/sp/questions/components/sp-questions';
import { useAuth } from '@/lib/auth-context';

export default function QuestionsPage() {
  const t = useTranslations('questions.timeline');
  const { api } = useAuth();
  const {
    questions,
    loading,
    error,
    createQuestion,
    editQuestion,
    archiveQuestion,
    unarchiveQuestion,
    acceptQuestion,
    rejectQuestion,
    fetchQuestions,
  } = useQuestions(api);

  return (
    <DeviceView
      sp={
        <SpQuestions
          questions={questions}
          loading={loading}
          createQuestion={createQuestion}
          editQuestion={editQuestion}
          archiveQuestion={archiveQuestion}
          acceptQuestion={acceptQuestion}
          rejectQuestion={rejectQuestion}
        />
      }
      pc={
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
              ) : error && questions.length === 0 ? (
                <ErrorState
                  message={t('error_message')}
                  onRetry={fetchQuestions}
                  retryLabel={t('retry')}
                />
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
      }
    />
  );
}
