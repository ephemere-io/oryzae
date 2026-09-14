'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { formatMonthDay } from '@/lib/format-date';

interface FermentationReadingProps {
  detail: FermentationDetail;
  /** 手紙に返事を書く。無ければ足元の返事を出さない（その問いのエントリーを書いている最中など）。 */
  onReply?: () => void;
  /** 手紙のもとになったエントリーを開く。無ければ一覧を出さない。 */
  onOpenSource?: (entryId: string) => void;
}

/** その人の言葉（手紙・キーワード・抜粋）の書体。道具の字（`CONTROL_FONT`）と混ぜない。 */
const SERIF_FONT = "'Noto Serif JP', serif";

/**
 * 発酵の結果を**読む**ための 1 本の縦の流れ（手紙・キーワード・スニペット、足元に返事）。
 *
 * 瓶の問いの画面と、エントリーの「発酵の結果」のシートが同じこの部品を使う（実機レビュー: 2 つの字と
 * 見出しがばらばらだった）。項目を押して別のシートで読む形（モーダルインモーダル）はやめ、キーワードの
 * 説明とスニペットの「選ばれた理由」まで最初から並べる。
 *
 * 足元の返事は、何への返事かが分かるように**手紙の書き出しを引く**（一番下の「返事を書く」が一番上の
 * 手紙のことだと読み取れなかった）。
 */
export function FermentationReading({ detail, onReply, onOpenSource }: FermentationReadingProps) {
  const t = useTranslations('fermentation.reading');
  const letter = detail.letter?.bodyText ?? null;
  const sources = onOpenSource ? detail.scannedEntries : [];
  const showFooter = letter !== null && (onReply !== undefined || sources.length > 0);

  return (
    <div
      className="flex flex-col gap-7"
      {...verifyAttrs({
        unit: 'FermentationReading',
        hasLetter: letter !== null,
        keywordCount: detail.keywords.length,
        snippetCount: detail.snippets.length,
        footer: showFooter,
      })}
    >
      {letter !== null ? (
        <Section label={t('section_letter')}>
          <article
            data-reading-letter
            data-testid="reading-letter"
            aria-label={t('section_letter')}
            className="flex flex-col gap-2"
          >
            {detail.targetPeriod ? (
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
              {letter}
            </p>
          </article>
        </Section>
      ) : null}

      {detail.keywords.length > 0 ? (
        <Section label={t('section_keywords')}>
          <ul className="m-0 flex list-none flex-col p-0">
            {detail.keywords.map((keyword) => (
              <Item key={keyword.id} marker="keyword">
                <p
                  className="m-0 text-[16px] leading-snug"
                  style={{ fontFamily: SERIF_FONT, color: 'var(--fg)' }}
                >
                  {keyword.keyword}
                </p>
                {keyword.description ? (
                  <p
                    className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.85]"
                    style={{ fontFamily: SERIF_FONT, color: 'var(--fg)', opacity: 0.78 }}
                  >
                    {keyword.description}
                  </p>
                ) : null}
              </Item>
            ))}
          </ul>
        </Section>
      ) : null}

      {detail.snippets.length > 0 ? (
        <Section label={t('section_snippets')}>
          <ul className="m-0 flex list-none flex-col p-0">
            {detail.snippets.map((snippet) => (
              <Item key={snippet.id} marker="snippet">
                <p
                  className="m-0 whitespace-pre-wrap text-[15px] leading-[1.9]"
                  style={{ fontFamily: SERIF_FONT, color: 'var(--fg)' }}
                >
                  「{snippet.originalText}」
                </p>
                <span
                  className="mt-1 block text-[11px] tracking-[0.06em]"
                  style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                >
                  {formatMonthDay(snippet.sourceDate)}
                </span>
                {snippet.selectionReason ? (
                  <div className="mt-2.5">
                    <SmallLabel>{t('selection_reason')}</SmallLabel>
                    <p
                      className="m-0 mt-1 whitespace-pre-wrap text-[14px] leading-[1.85]"
                      style={{ fontFamily: SERIF_FONT, color: 'var(--fg)', opacity: 0.78 }}
                    >
                      {snippet.selectionReason}
                    </p>
                  </div>
                ) : null}
              </Item>
            ))}
          </ul>
        </Section>
      ) : null}

      {showFooter && letter !== null ? (
        <footer
          data-letter-footer
          className="flex flex-col gap-4 border-t pt-5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {/* 何への返事か: 手紙の書き出しを引く。 */}
          <div data-letter-echo className="flex flex-col gap-1">
            <SmallLabel>{t('reply_to')}</SmallLabel>
            <p
              className="m-0 text-[14px] leading-relaxed"
              style={{
                fontFamily: SERIF_FONT,
                color: 'var(--date-color)',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              「{letter}」
            </p>
          </div>

          {sources.length > 0 ? (
            <div className="flex flex-col">
              <SmallLabel>{t('sources')}</SmallLabel>
              <ul className="m-0 mt-1 flex list-none flex-col p-0">
                {sources.map((source) => (
                  <li key={source.id}>
                    <button
                      type="button"
                      onClick={() => onOpenSource?.(source.id)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left text-[14px]"
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
              className="min-h-[48px] w-full rounded-full px-5 text-[14px] font-medium"
              style={{ ...CONTROL_FONT, background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {t('reply')}
            </button>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

/** 見出し（インデックス）。セミモーダルの見出しと同じ、アクセント色の小さな大文字。 */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3
        className="m-0 text-[11px] font-normal uppercase tracking-[0.14em]"
        style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
      >
        {label}
      </h3>
      {children}
    </section>
  );
}

function SmallLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="block text-[11px] tracking-[0.1em]"
      style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
    >
      {children}
    </span>
  );
}

/** 並びの 1 つ。罫で区切る（面は持たない。白いシートの上でもベージュの紙の上でも同じに見える）。 */
function Item({ marker, children }: { marker: 'keyword' | 'snippet'; children: ReactNode }) {
  return (
    <li
      data-reading-item={marker}
      className="border-b py-3.5 first:pt-1 last:border-b-0 last:pb-0"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {children}
    </li>
  );
}
