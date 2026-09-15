'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { formatMonthDay } from '@/lib/format-date';

interface FermentationReadingProps {
  detail: FermentationDetail;
  /**
   * キーワードの説明とスニペットの「選ばれた理由」の出し方。
   * - `all`: 最初から全部並べる（書きながら見る。一覧性が要る）
   * - `tap`: 行を押すと、その場で開く（瓶で読む。窓を 1 つずつ開ける楽しみ）
   */
  reveal?: 'all' | 'tap';
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
 * 瓶の問いの画面と、エントリーの「発酵の結果」のシートが同じこの部品を使う（字と見出しを揃える）。
 * 項目を押して別のシートで読む形（モーダルインモーダル）はやめた。瓶では行を押すと**その場で開く**
 * （`reveal="tap"`。全部出ていると「文字量が多い」と感じ、押して開けるほうがアドベントカレンダーの窓の
 * ように楽しい、とレビュー）。エントリーの中は書きながら見渡すので最初から全部（`reveal="all"`）。
 *
 * 足元の返事は「この手紙に返事を書く」と言う。手紙の書き出しを引いて見せていたが、上の手紙と同じ中身の
 * 繰り返しで「？」になった（レビュー）。
 */
export function FermentationReading({
  detail,
  reveal = 'all',
  onReply,
  onOpenSource,
}: FermentationReadingProps) {
  const t = useTranslations('fermentation.reading');
  const letter = detail.letter?.bodyText ?? null;
  const sources = onOpenSource ? detail.scannedEntries : [];
  const showFooter = letter !== null && (onReply !== undefined || sources.length > 0);

  return (
    <div
      className="flex flex-col gap-7"
      {...verifyAttrs({
        unit: 'FermentationReading',
        reveal,
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
              <Item
                key={keyword.id}
                marker="keyword"
                reveal={keyword.description ? reveal : 'all'}
                openLabel={t('open_detail')}
                summary={() => (
                  <p
                    className="m-0 text-[16px] leading-snug"
                    style={{ fontFamily: SERIF_FONT, color: 'var(--fg)' }}
                  >
                    {keyword.keyword}
                  </p>
                )}
              >
                {keyword.description ? (
                  <p
                    className="m-0 pt-1.5 whitespace-pre-wrap text-[14px] leading-[1.85]"
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
              <Item
                key={snippet.id}
                marker="snippet"
                reveal={snippet.selectionReason ? reveal : 'all'}
                openLabel={t('open_detail')}
                summary={(open) => (
                  <>
                    <p
                      className="m-0 whitespace-pre-wrap text-[15px] leading-[1.9]"
                      style={{
                        fontFamily: SERIF_FONT,
                        color: 'var(--fg)',
                        // 閉じている間は 2 行に畳む（開けば全文）。
                        ...(open
                          ? {}
                          : {
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                              overflow: 'hidden',
                            }),
                      }}
                    >
                      「{snippet.originalText}」
                    </p>
                    <span
                      className="mt-1 block text-[11px] tracking-[0.06em]"
                      style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                    >
                      {formatMonthDay(snippet.sourceDate)}
                    </span>
                  </>
                )}
              >
                {snippet.selectionReason ? (
                  <div className="pt-2.5">
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

      {showFooter ? (
        <footer
          data-letter-footer
          className="flex flex-col gap-4 border-t pt-5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
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

interface ItemProps {
  marker: 'keyword' | 'snippet';
  reveal: 'all' | 'tap';
  /** 開く印の読み上げ名。 */
  openLabel: string;
  /** いつも見えている部分（開いているかを受け取る）。 */
  summary: (open: boolean) => ReactNode;
  /** 開くと見える部分（`reveal="all"` なら最初から）。 */
  children: ReactNode;
}

/**
 * 並びの 1 つ。罫で区切る（面は持たない。白いシートの上でもベージュの紙の上でも同じに見える）。
 *
 * `reveal="tap"` なら行全体がボタンで、押すとその場で開く。開く動きは CSS（`grid-template-rows`
 * の 0fr → 1fr、`globals.css` の `.oz-disclosure`）で、高さを測らない。閉じている中身は `inert`。
 */
function Item({ marker, reveal, openLabel, summary, children }: ItemProps) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const className = 'border-b py-3.5 first:pt-1 last:border-b-0 last:pb-0';
  const style = { borderColor: 'var(--border-subtle)' };

  if (reveal === 'all') {
    return (
      <li data-reading-item={marker} className={className} style={style}>
        {summary(true)}
        {children}
      </li>
    );
  }

  return (
    <li data-reading-item={marker} data-open={open} className={className} style={style}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[44px] w-full items-start gap-3 text-left"
      >
        <span className="min-w-0 flex-1">{summary(open)}</span>
        <span
          aria-hidden="true"
          title={openLabel}
          className="oz-disclosure-mark"
          data-open={open}
        />
      </button>
      <div id={regionId} className="oz-disclosure" data-open={open} inert={!open}>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </li>
  );
}
