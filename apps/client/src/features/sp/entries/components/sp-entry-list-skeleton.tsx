import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * SP 一覧（SpEntryList）のスケルトン。
 *
 * SP は PC と全く別レイアウト（全幅・ヘッダに並び替え・検索は角丸ボックス・問いチップの
 * 横スクロール行・行はタイトル＋メタの2段）。PC 一覧の枠を流用すると読み込み後に総入れ替えになる。
 *
 * 2粒度を公開する:
 *  - `SpEntryListRowsSkeleton` … 行だけ。SpEntryList 本体が chrome を実物で描いている最中に使う。
 *  - `SpEntryListSkeleton` … 画面まるごと。ページ遷移/初回描画の枠に使う。
 */

/** 一覧の「行」だけ（実物: li = 本文ボタン py-4 ＋ ⋯ ボタン）。 */
export function SpEntryListRowsSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="mt-1 flex-1 overflow-hidden px-5" data-skeleton-slot="rows" aria-hidden="true">
      {skeletonKeys(rows).map((k) => (
        <div
          key={k}
          className="flex items-center gap-1 border-b border-[color-mix(in_srgb,var(--fg)_6%,transparent)]"
        >
          <div className="min-w-0 flex-1 py-4">
            <Skeleton className="h-[15px] w-3/5" />
            <Skeleton className="mt-1.5 h-[11px] w-2/5" />
          </div>
          <Skeleton className="m-2 h-[18px] w-[18px] shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * 問いチップ行の枠だけ。SpEntryList 本体でも使う（PC と同じく、取得が終わるまで
 * 行の有無を決められないので場所を取っておく）。
 */
export function SpEntryListChipsSkeleton({ chips = 3 }: { chips?: number }) {
  return (
    <div className="mt-3 flex gap-2 px-5 pb-1" data-skeleton-slot="chips">
      {skeletonKeys(chips).map((k) => (
        <Skeleton key={k} className="h-7 w-20 shrink-0 rounded-full" />
      ))}
    </div>
  );
}

/** 画面まるごと（ヘッダ ＋ 検索 ＋ 問いチップ ＋ 行）。 */
export function SpEntryListSkeleton({ rows = 7, chips = 3 }: { rows?: number; chips?: number }) {
  return (
    <div
      className="flex h-full flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({
        unit: 'SpEntryListSkeleton',
        slots: chips > 0 ? 'header,search,chips,rows' : 'header,search,rows',
        rows,
        chips,
      })}
    >
      {/* ヘッダ（実物: px-5 pt-6 pb-3、左=タイトル text-lg / 右=並び替えトグル） */}
      <div className="flex items-center justify-between px-5 pt-6 pb-3" data-skeleton-slot="header">
        <Skeleton className="h-[22px] w-24" />
        <Skeleton className="h-3.5 w-16" />
      </div>

      {/* 検索（実物: px-5 の中に rounded-xl px-3 py-2.5 のボックス = 42px） */}
      <div className="px-5">
        <Skeleton className="h-[42px] w-full rounded-xl" data-skeleton-slot="search" />
      </div>

      {/* 問いチップ（実物: mt-3 gap-2 px-5 pb-1、pill は px-3 py-1.5 = 28px） */}
      {chips > 0 && <SpEntryListChipsSkeleton chips={chips} />}

      <SpEntryListRowsSkeleton rows={rows} />
    </div>
  );
}
