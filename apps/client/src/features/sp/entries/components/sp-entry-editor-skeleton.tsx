import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * SP エディタ（SpEntryEditor）のスケルトン。
 *
 * PC エディタの4段（ツールバー/リンカ/本文/ステータス）とは別物で、SP は
 * ステータス行 → 大きなタイトル → 問いチップ → 本文 → （既存エントリのみ）漬け込み CTA。
 * SP エディタは常に横書きなので、本文は行の枠を置ける（PC は書字方向が確定しないので置かない）。
 */
export function SpEntryEditorSkeleton({
  bodyLines = 4,
  withPickleCta = false,
}: {
  /** 本文の行枠の数。新規エントリは本文が空なので 0 を渡す。 */
  bodyLines?: number;
  /** 既存エントリだけに出る「発酵させる」CTA の枠。 */
  withPickleCta?: boolean;
}) {
  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({
        unit: 'SpEntryEditorSkeleton',
        slots: withPickleCta ? 'status,title,chip,body,pickle-cta' : 'status,title,chip,body',
        bodyLines,
      })}
    >
      {/* 保存ステータス行（実物: px-5 pt-3 pb-1 / minHeight 28、右寄せの小さな文字） */}
      <div
        className="flex items-center justify-end px-5 pt-3 pb-1"
        // 実物と同じだけ「書斎へ戻る」マークの席を空ける（実物は読んでいた）。
        style={{ minHeight: 28, paddingLeft: 'max(1.25rem, var(--study-back-inset, 0px))' }}
        data-skeleton-slot="status"
      >
        <Skeleton className="h-3 w-16" />
      </div>

      {/* タイトル（実物: px-5 pt-2 text-2xl leading-snug = 33px） */}
      {/* 実物と同じく、マークの高さぶん行ごと下へ落とす（左を空けるだけでは頭が重なる）。 */}
      <div className="px-5" style={{ paddingTop: 'max(0.5rem, var(--study-back-drop, 0px))' }}>
        <Skeleton className="h-[33px] w-3/4" data-skeleton-slot="title" />
      </div>

      {/* 問いチップ（実物: px-5 pt-4 / rounded-full px-3 py-1.5 = 28px） */}
      <div className="px-5 pt-4">
        <Skeleton className="h-7 w-40 rounded-full" data-skeleton-slot="chip" />
      </div>

      {/* 本文（実物: mt-6 px-5 pb-4 text-base / lineHeight 2 = 1行 32px） */}
      <div className="mt-6 flex flex-1 flex-col gap-4 px-5 pb-4" data-skeleton-slot="body">
        {skeletonKeys(bodyLines).map((k, i) => (
          <Skeleton key={k} className={`h-4 ${i % 3 === 2 ? 'w-3/5' : 'w-full'}`} />
        ))}
      </div>

      {/* 漬け込み CTA（実物: mx-4 mb-4 / rounded-2xl py-4 ＋ 説明文） */}
      {withPickleCta && (
        <div className="mx-4 mb-4" data-skeleton-slot="pickle-cta">
          <Skeleton className="h-[52px] w-full rounded-2xl" />
          <Skeleton className="mx-auto mt-2 h-3 w-2/3" />
        </div>
      )}
    </div>
  );
}
