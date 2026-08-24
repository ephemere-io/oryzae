import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * PC 問い一覧（QuestionTimeline）のスケルトン。
 *
 * 問いの画面は一覧ではなく**縦のタイムライン**（中央寄せの見出し → 左に縦罫 →
 * 日付ノード → 出来事カード）。エントリ一覧の行枠を出すと読み込み完了時に
 * 左の罫線ぶん横へ、見出しぶん縦へまとめてズレる。
 */

/** 出来事カード1枚（実物: rounded-[10px] border-l-[3px] px-5 py-3.5）。 */
function TimelineEventSkeleton() {
  return (
    <div className="rounded-[10px] border-l-[3px] border-l-[var(--border-subtle)] bg-[rgba(200,180,140,0.08)] px-5 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
            <Skeleton className="h-[11px] w-12" />
          </div>
          <Skeleton className="h-[14px] w-4/5" />
          <Skeleton className="h-[11px] w-24" />
        </div>
        <Skeleton className="h-[22px] w-16 shrink-0 rounded-full" />
      </div>
    </div>
  );
}

/**
 * タイムライン本体の枠。
 * @param groups 日付ノードの数
 * @param eventsPerGroup 1ノードあたりの出来事カード数
 */
export function QuestionTimelineSkeleton({
  groups = 2,
  eventsPerGroup = 2,
}: {
  groups?: number;
  eventsPerGroup?: number;
}) {
  return (
    <div
      className="flex flex-col gap-2"
      aria-hidden="true"
      {...verifyAttrs({
        unit: 'QuestionTimelineSkeleton',
        slots: 'heading,timeline',
        groups,
        eventsPerGroup,
      })}
    >
      {/* 見出し（実物: mb-12 text-center、22px の題 ＋ mt-3 の 13px 補足） */}
      <div className="mb-12 flex flex-col items-center" data-skeleton-slot="heading">
        <Skeleton className="h-[22px] w-48" />
        <Skeleton className="mt-3 h-[13px] w-64" />
      </div>

      {/* タイムライン（実物: relative pl-8 ＋ 左の縦罫） */}
      <div className="relative pl-8" data-skeleton-slot="timeline">
        <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-[rgba(139,115,85,0.15)]" />
        {skeletonKeys(groups).map((groupKey) => (
          <div key={groupKey} className="mb-10">
            {/* 日付ノード（実物: dot は -left-[22px]） */}
            <div className="relative mb-4 flex items-center">
              <Skeleton className="absolute -left-[22px] h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-[11px] w-20" />
            </div>
            <div className="flex flex-col gap-2.5">
              {skeletonKeys(eventsPerGroup).map((eventKey) => (
                <TimelineEventSkeleton key={`${groupKey}-${eventKey}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
