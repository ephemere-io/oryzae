'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Skeleton, skeletonKeys } from '@/components/ui/skeleton';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import type { SpJarElement } from '@/features/sp/fermentation/components/sp-element-sheet';
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
  onOpenElement: (element: SpJarElement) => void;
}

/** その人の言葉（問い・言葉・抜粋）の書体。道具の字（`CONTROL_FONT`）と混ぜない。 */
const SERIF_FONT = "'Noto Serif JP', serif";

/**
 * シャーレを押した先。**上に問いが 1 行、下に手紙・言葉・抜粋の一覧。**
 *
 * 項目を押すと `SpElementSheet`（高さを変えられるセミモーダル）で全文を読む。
 * 一覧は縦に伸びるだけなので、数が増えても重ならず切れない。
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
  onOpenElement,
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

      {/* 一覧。行を押すと全文（セミモーダル）。 */}
      <div className="min-h-0 flex-1 overflow-auto px-5 pt-4 pb-8">
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

        {letter ? (
          <Section label={t('section_letter')}>
            {/* 手紙は最初から本文を出す（もう一度押さないと読めないのは不便、と実機レビュー）。 */}
            <article
              data-testid="sp-jar-letter"
              aria-label={t('section_letter')}
              className="flex flex-col gap-3 py-1"
            >
              {detail?.targetPeriod ? (
                <span
                  className="text-[11px] tracking-[0.08em]"
                  style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                >
                  {detail.targetPeriod.replace('-', '.')}
                </span>
              ) : null}
              <p
                className="m-0 whitespace-pre-wrap text-[15px] leading-[1.95]"
                style={{ fontFamily: SERIF_FONT, color: 'var(--fg)' }}
              >
                {letter.bodyText}
              </p>
              {/* もとになった記録（Issue #453: 何に対する返事かが分かる）。無ければ出さない。 */}
              {(detail?.scannedEntries.length ?? 0) > 0 ? (
                <div className="flex flex-col gap-1">
                  <span
                    className="text-[11px] uppercase tracking-[0.12em]"
                    style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                  >
                    {t('section_sources')}
                  </span>
                  <ul className="flex flex-col">
                    {(detail?.scannedEntries ?? []).map((source) => (
                      <li key={source.id}>
                        <button
                          type="button"
                          onClick={() => onOpenSource?.(source.id)}
                          className="flex min-h-[40px] w-full items-center justify-between gap-3 text-left text-[14px]"
                          style={{ fontFamily: SERIF_FONT, color: 'var(--fg)' }}
                        >
                          <span className="min-w-0 truncate">
                            {source.title || t('source_untitled')}
                          </span>
                          <span
                            className="shrink-0 text-[11px]"
                            style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                          >
                            {formatMonthDay(source.createdAt)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {onReply ? (
                <button
                  type="button"
                  data-letter-reply
                  onClick={onReply}
                  className="min-h-[44px] self-start rounded-full px-5 text-[14px] font-medium"
                  style={{ ...CONTROL_FONT, background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  {t('reply')}
                </button>
              ) : null}
            </article>
          </Section>
        ) : null}

        {keywords.length > 0 ? (
          <Section label={t('section_keywords')}>
            {keywords.map((keyword) => (
              <Row
                key={keyword.id}
                onClick={() =>
                  onOpenElement({
                    kind: 'keyword',
                    id: keyword.id,
                    keyword: keyword.keyword,
                    description: keyword.description,
                  })
                }
              >
                <span
                  className="min-w-0 flex-1 text-[15px] leading-snug"
                  style={{ fontFamily: SERIF_FONT, color: 'var(--fg)' }}
                >
                  {keyword.keyword}
                </span>
              </Row>
            ))}
          </Section>
        ) : null}

        {snippets.length > 0 ? (
          <Section label={t('section_snippets')}>
            {snippets.map((snippet) => (
              <Row
                key={snippet.id}
                onClick={() =>
                  onOpenElement({
                    kind: 'snippet',
                    id: snippet.id,
                    originalText: snippet.originalText,
                    sourceDate: snippet.sourceDate,
                    selectionReason: snippet.selectionReason,
                  })
                }
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[14px] leading-relaxed"
                    style={{
                      fontFamily: SERIF_FONT,
                      color: 'var(--fg)',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 3,
                      overflow: 'hidden',
                    }}
                  >
                    「{snippet.originalText}」
                  </span>
                  <span
                    className="mt-1 block text-[11px] tracking-[0.06em]"
                    style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                  >
                    {formatMonthDay(snippet.sourceDate)}
                  </span>
                </span>
              </Row>
            ))}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <p
        className="mb-1 text-[11px] uppercase tracking-[0.14em]"
        style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
      >
        {label}
      </p>
      <ul className="m-0 list-none p-0">{children}</ul>
    </section>
  );
}

interface RowProps {
  onClick: () => void;
  /** 文字を持たない行（手紙）を掴むための目印。 */
  testId?: string;
  /** 中身が絵だけの行に名前を与える（読み上げで「ボタン」としか言われなくなる）。 */
  ariaLabel?: string;
  children: React.ReactNode;
}

/** 紙の上の 1 行。面は持たず、罫 1 本と末尾の › で押せることを示す。 */
function Row({ onClick, testId, ariaLabel, children }: RowProps) {
  return (
    <li className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        aria-label={ariaLabel}
        className="flex min-h-[52px] w-full items-center gap-3 py-3 text-left"
      >
        {children}
        <span
          aria-hidden="true"
          className="shrink-0 text-[18px] leading-none"
          style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
        >
          ›
        </span>
      </button>
    </li>
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
