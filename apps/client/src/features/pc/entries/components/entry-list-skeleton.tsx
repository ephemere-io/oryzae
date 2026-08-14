import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * PC 一覧（EntryList）のスケルトン。
 *
 * スケルトンは「いずれ出るレイアウトを先に置く」ためのものなので、EntryList の実 DOM と
 * 同じ順序・同じ寸法で組む:
 *   問いフィルタ行(mb-3) → 検索バー(mb-4/42px) → 月見出し → 週ラベル → EntryCard 行
 * EntryCard の行は `border-b` ＋ padding `16px 44px 16px 12px` の中に
 * 日付(10px)・タイトル(15px)・本文プレビュー(13px)・フッタ(10px) が積まれる。
 *
 * 2粒度を公開する:
 *  - `EntryListRowsSkeleton` … 行だけ。EntryList 本体が chrome（フィルタ/検索）を実物で
 *    描いている最中に使う。
 *  - `EntryListSkeleton` … chrome も含む一覧まるごと。ページ遷移/初回描画の枠に使う。
 */

/** EntryCard 1件ぶんの枠（実カードと同じ padding / 行構成）。 */
function EntryCardSkeleton() {
  return (
    <div
      className="border-b border-[var(--border-subtle)]"
      style={{ padding: '16px 44px 16px 12px' }}
    >
      <Skeleton className="mb-1 h-2.5 w-28" />
      <Skeleton className="mb-1.5 h-[15px] w-3/5" />
      <Skeleton className="mb-2 h-[13px] w-full" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  );
}

/**
 * 一覧の「行」部分だけ。EntryList のデータ待ちで使う（chrome は本体が実物を描いている）。
 * 月見出し・週ラベルまで含めるのは、データ到着時に行が縦へずれないようにするため。
 */
export function EntryListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div data-testid="entry-list-skeleton" data-skeleton-slot="rows" aria-hidden="true">
      {/* 月見出し（実物: border-b pb-2 pt-6 text-sm） */}
      <div className="border-b border-[var(--border-subtle)] pb-2 pt-6">
        <Skeleton className="h-3.5 w-24" />
      </div>
      {/* 週ラベル（実物: pt-4 pb-2 text-xs） */}
      <div className="pt-4 pb-2">
        <Skeleton className="h-3 w-16" />
      </div>
      {skeletonKeys(rows).map((k) => (
        <EntryCardSkeleton key={k} />
      ))}
    </div>
  );
}

/**
 * 一覧まるごと（chrome ＋ 行）。`/entries` の遷移フォールバック・初回描画で使う。
 * `withFilter` は問いフィルタ行の有無（EntryList は問いが1件以上あるときだけ出す）。
 */
export function EntryListSkeleton({
  rows = 4,
  withFilter = true,
}: {
  rows?: number;
  withFilter?: boolean;
}) {
  return (
    <div
      className="flex flex-col"
      aria-hidden="true"
      {...verifyAttrs({
        unit: 'EntryListSkeleton',
        slots: withFilter ? 'filter,search,rows' : 'search,rows',
        rows,
      })}
    >
      {withFilter && (
        <div className="mb-3 flex items-center gap-2" data-skeleton-slot="filter">
          <Skeleton className="h-3 w-12 shrink-0" />
          <Skeleton className="h-[38px] flex-1 rounded-lg" />
        </div>
      )}
      <Skeleton className="mb-4 h-[42px] w-full rounded-lg" data-skeleton-slot="search" />
      <EntryListRowsSkeleton rows={rows} />
    </div>
  );
}
