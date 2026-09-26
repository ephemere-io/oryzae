'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { FermentationReading } from '@/features/shared/fermentation/components/fermentation-reading';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { formatMonthDay } from '@/lib/format-date';
import { useSpBackHandler, useSpChrome, useSpHeading } from '@/lib/sp-chrome-context';
import { useDelayedTrue } from '@/lib/use-delayed';

interface SpQuestionZoomProps {
  questionText: string;
  detail: FermentationDetail | null;
  loading: boolean;
  /** これまでの発酵（新しい順）。2 回以上あれば日付のチップを出す（PC の履歴の SP 版）。 */
  history?: readonly { fermentationId: string; createdAt: string }[];
  selectedFermentationId?: string | null;
  onSelectFermentation?: (fermentationId: string) => void;
  /** 手紙に返事を書く（新規エントリーへ）。 */
  onReply?: () => void;
  /** 手紙のもとになった記録を開く。 */
  onOpenSource?: (entryId: string) => void;
  onClose: () => void;
}

/** その人の言葉（問い・言葉・抜粋）の書体。道具の字（`CONTROL_FONT`）と混ぜない。 */
const SERIF_FONT = "'Noto Serif JP', serif";

/**
 * シャーレを押した先。**上に問いを題として全文、下に手紙・キーワード・スニペットを読む流れ。**
 *
 * 題の出し方は**エントリーの題と同じ**: いちばん上まで戻れば全文で大きく、スクロールして題が上段の下に隠れたら
 * 上段の中央に 1 行で上がる（`useSpHeading`）。以前は問いを 1 行に畳み、押すと全文、という別の作りで、エントリーと
 * 振る舞いが揃っていなかった（実機レビュー）。
 *
 * 中身はエントリーの「発酵の結果」と同じ `FermentationReading`（キーワードとスニペットは押すとその場で開く）。
 *
 * 「戻る」は上段（`SpTopBar`）の左端の正円が担う。この画面が出ている間だけ上段の戻るを横取りして、書斎ではなく
 * 地図へ戻す（`useSpBackHandler`）。上段が無い場所（孤立検証・テスト）では自前の戻るを出す。
 */
export function SpQuestionZoom({
  questionText,
  detail,
  loading,
  history = [],
  selectedFermentationId = null,
  onSelectFermentation,
  onReply,
  onOpenSource,
  onClose,
}: SpQuestionZoomProps) {
  const t = useTranslations('sp.jar');
  const tNav = useTranslations('sp.nav');
  const { mounted } = useSpChrome();
  useSpBackHandler(mounted ? onClose : null);

  // 題が読む流れの上端より上へ隠れているか。隠れている間だけ上段に題を出す（エントリーと同じ）。
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [titleHidden, setTitleHidden] = useState(false);
  useEffect(() => {
    const element = titleRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setTitleHidden(entry.intersectionRatio < 1);
      },
      { root: scrollRef.current, threshold: [1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useSpHeading(titleHidden ? questionText : null);

  const keywords = detail?.keywords ?? [];
  const snippets = detail?.snippets ?? [];
  const letter = detail?.letter ?? null;
  const empty = !loading && keywords.length === 0 && snippets.length === 0 && letter === null;
  const showSkeleton = useDelayedTrue(loading);

  return (
    <div
      className="sp-rise absolute inset-0 z-20 flex flex-col"
      style={{ background: 'var(--bg)' }}
      {...verifyAttrs({
        unit: 'SpQuestionZoom',
        loading,
        keywordCount: keywords.length,
        snippetCount: snippets.length,
        hasLetter: letter !== null,
        empty,
        titleHidden,
        ownBack: !mounted,
        historyCount: history.length,
      })}
    >
      {!mounted ? (
        <header className="flex shrink-0 px-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            aria-label={tNav('back')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--surface-sunken)', color: 'var(--fg)' }}
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={ICON_STROKE_WIDTH + 0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
            </svg>
          </button>
        </header>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-10">
        {/* 題（エントリーの題と同じ大きさ・余白）。全文を折り返して出す。 */}
        <h1
          ref={titleRef}
          data-question-heading
          className="m-0 px-6 pt-3 text-2xl font-medium leading-snug"
          style={{ fontFamily: SERIF_FONT, color: 'var(--fg)', letterSpacing: '0.02em' }}
        >
          {questionText}
        </h1>

        {/* 発酵の回（新しい順）。最初は「最新」、ほかは日付。押せばその回に切り替わる（PC の履歴の SP 版）。 */}
        {history.length > 1 ? (
          <div
            data-history-strip
            className="flex items-center gap-2 overflow-x-auto px-6 pt-4"
            style={{ ...CONTROL_FONT, scrollbarWidth: 'none' }}
          >
            {history.map((item, index) => {
              const active = item.fermentationId === selectedFermentationId;
              return (
                <button
                  key={item.fermentationId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectFermentation?.(item.fermentationId)}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-[12px] tracking-[0.04em]"
                  style={{
                    borderColor: active ? 'var(--accent)' : 'var(--border-subtle)',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--bg)' : 'var(--fg)',
                  }}
                >
                  {index === 0 ? t('history_latest') : formatMonthDay(item.createdAt)}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* 読む流れ。エントリーの「発酵の結果」と同じ部品。キーワードとスニペットは押すとその場で開く。 */}
        <div className="px-5 pt-5">
          {/* 読み込み中は、いずれ出る形（見出しと行）を先に置く。一瞬で返るなら出さない。 */}
          {showSkeleton ? <QuestionZoomSkeleton /> : null}

          {empty ? (
            <p
              className="px-6 py-8 text-center text-sm leading-relaxed"
              style={{ color: 'var(--date-color)' }}
            >
              {t('not_fermented')}
            </p>
          ) : null}

          {detail && !empty ? (
            <FermentationReading
              detail={detail}
              reveal="tap"
              onReply={onReply}
              onOpenSource={onOpenSource}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 読み込み中の骨組み。手紙 1 行・言葉 3 行・抜粋 2 行の、実物と同じ並び。 */
function QuestionZoomSkeleton() {
  return (
    <div aria-hidden="true" data-skeleton-slot="question-zoom" className="flex flex-col gap-6">
      {[1, 3, 2].map((rows, index) => (
        <div key={skeletonKeys(3)[index]} className="flex flex-col gap-3">
          <Skeleton className="h-3 w-12" />
          {skeletonKeys(rows).map((key) => (
            <Skeleton key={key} className="h-5 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
