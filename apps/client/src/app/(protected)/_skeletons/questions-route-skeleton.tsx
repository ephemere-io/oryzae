'use client';

import { DeviceView } from '@/components/device-view';
import { Skeleton } from '@/components/ui/skeleton';
import { QuestionTimelineSkeleton } from '@/features/pc/questions/components/question-timeline-skeleton';
import { SpQuestionsSkeleton } from '@/features/sp/questions/components/sp-questions-skeleton';

/**
 * `/questions` のロード枠。PC は中央 **800px**（一覧の 680px とは別）の枠に
 * 作成フォーム ＋ タイムライン。SP はカードの縦積み。
 * page.tsx と同じ合成（枠 → 作成フォーム → mt-6 → タイムライン）にしてある。
 */
export function QuestionsRouteSkeleton() {
  return (
    <DeviceView
      sp={<SpQuestionsSkeleton />}
      pc={
        <div className="flex min-h-full flex-col">
          <div className="mx-auto w-full max-w-[800px] flex-1 px-6 pt-6 pb-20">
            {/* 作成フォーム（実物: flex gap-2 の pill 入力 ＋ pill ボタン、いずれも 38px） */}
            <div className="flex gap-2">
              <Skeleton className="h-[38px] flex-1 rounded-full" />
              <Skeleton className="h-[38px] w-24 rounded-full" />
            </div>
            <div className="mt-6">
              <QuestionTimelineSkeleton />
            </div>
          </div>
        </div>
      }
    />
  );
}
