'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { FermentationReading } from '@/features/shared/fermentation/components/fermentation-reading';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { formatMonthDay } from '@/lib/format-date';
import { useSpBackHandler, useSpChrome } from '@/lib/sp-chrome-context';
import { useDelayedTrue } from '@/lib/use-delayed';

interface SpQuestionZoomProps {
  questionText: string;
  detail: FermentationDetail | null;
  loading: boolean;
  /** これまでの発酵（新しい順）。2 回以上あれば日付の帯を出す（PC の履歴の SP 版）。 */
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
 * シャーレを押した先。**上に問いが 1 行、下に手紙・キーワード・スニペットを読む流れ。**
 *
 * 中身はエントリーの「発酵の結果」と同じ `FermentationReading`。項目を押して重なるシートで読む形
 * （モーダルインモーダル）はやめた: 閉じたあと開けなくなることがあり、そもそも最初の画面で説明と
 * 理由まで読めれば足りる（実機レビュー）。縦に伸びるだけなので、数が増えても重ならず切れない。
 *
 * 「戻る」は上段（`SpTopBar`）の左端の正円が担う。この画面が出ている間だけ
 * 上段の戻るを横取りして、書斎ではなく地図へ戻す（`useSpBackHandler`）。
 * 上段が無い場所（孤立検証・テスト）では自前の戻るを出す。
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
  /** 長い問いは 1 行に畳む。押すと全文（もう一度押すと戻る）。 */
  const [expanded, setExpanded] = useState(false);

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
        expanded,
        ownBack: !mounted,
        historyCount: history.length,
      })}
    >
      {/* 問いの行。上段の直下、画面のいちばん上。 */}
      <header
        className="flex shrink-0 items-start gap-2 border-b px-3 pt-2 pb-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {!mounted ? (
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
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          title={questionText}
          className="min-h-[44px] min-w-0 flex-1 px-2 text-left"
        >
          <h2
            data-question-heading
            className={`m-0 text-[16px] font-medium leading-relaxed ${expanded ? '' : 'truncate'}`}
            style={{ fontFamily: SERIF_FONT, color: 'var(--fg)', letterSpacing: '0.02em' }}
          >
            {questionText}
          </h2>
        </button>
      </header>

      {/* これまでの発酵（新しい順）。押せばその回に切り替わる。PC の履歴（cover flow）の SP 版。 */}
      {history.length > 1 ? (
        <div
          data-history-strip
          className="flex shrink-0 items-center gap-2 overflow-x-auto px-4 py-2"
          style={{ ...CONTROL_FONT, scrollbarWidth: 'none' }}
        >
          <span className="shrink-0 text-[11px]" style={{ color: 'var(--date-color)' }}>
            {t('history')}
          </span>
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
                {index === 0 ? `${t('history_latest')} · ` : ''}
                {formatMonthDay(item.createdAt)}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* 読む流れ。エントリーの「発酵の結果」と同じ部品（言葉の説明・抜粋の理由まで最初から並ぶ）。 */}
      <div className="min-h-0 flex-1 overflow-auto px-5 pt-4 pb-10">
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
          <FermentationReading detail={detail} onReply={onReply} onOpenSource={onOpenSource} />
        ) : null}
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
