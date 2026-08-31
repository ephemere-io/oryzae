import { verifyAttrs } from '@oryzae/verify';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';

/**
 * SP 問い（SpQuestions）のスケルトン。
 *
 * PC のタイムラインとは別物で、SP は「ヘッダ ＋ 説明文 ＋ 角丸カードの縦積み ＋
 * 破線の追加ボタン」。カードは一覧の行（境界線で区切られた薄い行）とは違い、
 * 塗りのある独立したブロックなので、一覧枠を流用すると印象から違って見える。
 *
 * 2粒度を公開する:
 *  - `SpQuestionsCardsSkeleton` … カード群だけ。SpQuestions 本体が chrome を実物で描く最中に使う。
 *  - `SpQuestionsSkeleton` … 画面まるごと。
 */

/** カード群だけ（実物: rounded-2xl p-4 のブロック ＋ 末尾に破線の追加ボタン）。 */
export function SpQuestionsCardsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="flex-1 overflow-hidden px-5 pb-4" data-skeleton-slot="cards" aria-hidden="true">
      {skeletonKeys(cards).map((k) => (
        <div
          key={k}
          className="mb-3 rounded-2xl p-4"
          style={{ background: 'var(--ob-card-bg)', border: '1px solid var(--border-subtle)' }}
        >
          <Skeleton className="h-[15px] w-4/5" />
        </div>
      ))}
      {/* 追加ボタン（実物: 破線 rounded-2xl py-3.5） */}
      <div
        className="mt-1 flex w-full items-center justify-center rounded-2xl py-3.5"
        style={{ border: '1.5px dashed var(--border-subtle)' }}
        data-skeleton-slot="add"
      >
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}

/** 画面まるごと（ヘッダ ＋ 説明文 ＋ カード群）。 */
export function SpQuestionsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({ unit: 'SpQuestionsSkeleton', slots: 'header,intro,cards,add', cards })}
    >
      {/* ヘッダ（実物: px-5 pt-6 pb-1 text-lg） */}
      <div className="px-5 pt-6 pb-1" data-skeleton-slot="header">
        <Skeleton className="h-[22px] w-20" />
      </div>
      {/* 説明文（実物: px-5 pb-2 text-xs leading-relaxed の2行） */}
      <div className="flex flex-col gap-1 px-5 pb-2" data-skeleton-slot="intro">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <SpQuestionsCardsSkeleton cards={cards} />
    </div>
  );
}
