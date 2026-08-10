import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * SP 瓶（SpJar）のスケルトン。
 *
 * SP の /jar は PC の盤面ではなく「届いた発酵（手紙）の受信箱」。行は
 * 未読ドット ＋ 問い文 ＋ 「未読/既読 · 日付」の2段で、エントリ一覧の行とも形が違う
 * （こちらは先頭に必ずドットが入り、行内に ⋯ ボタンが無い）。
 *
 * 2粒度を公開する:
 *  - `SpJarRowsSkeleton` … 行だけ。SpJar 本体がヘッダを実物で描いている最中に使う。
 *  - `SpJarSkeleton` … 画面まるごと。ページ遷移/初回描画の枠に使う。
 */

/** 手紙の行だけ（実物: li > button = ドット ＋ 問い文 ＋ メタ、border-b py-4）。 */
export function SpJarRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex-1 overflow-hidden px-5" data-skeleton-slot="rows" aria-hidden="true">
      {skeletonKeys(rows).map((k) => (
        <div
          key={k}
          className="flex items-center gap-3 border-b border-[color-mix(in_srgb,var(--fg)_8%,transparent)] py-4"
        >
          <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-1 h-[11px] w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 画面まるごと（ヘッダ ＋ 手紙の行）。 */
export function SpJarSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({ unit: 'SpJarSkeleton', slots: 'header,rows', rows })}
    >
      {/* ヘッダ（実物: px-5 pt-6 pb-3 text-lg） */}
      <div className="px-5 pt-6 pb-3" data-skeleton-slot="header">
        <Skeleton className="h-[22px] w-20" />
      </div>
      <SpJarRowsSkeleton rows={rows} />
    </div>
  );
}
