'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { ScannedEntry } from '@/features/shared/fermentation/types';
import { formatMonthDay } from '@/lib/format-date';

/** 問いの画面の一覧で押せるもの。中身はすべてここで読む。 */
export type SpJarElement =
  | { kind: 'keyword'; id: string; keyword: string; description: string }
  | {
      kind: 'snippet';
      id: string;
      originalText: string;
      sourceDate: string;
      selectionReason: string;
    }
  | {
      kind: 'letter';
      id: string;
      bodyText: string;
      /** 手紙のもとになった記録（Issue #453）。手紙だけでは何への返事か分からない。 */
      sources: ScannedEntry[];
    };

interface SpElementSheetProps {
  element: SpJarElement;
  onClose: () => void;
  /** 手紙にだけ出る「返事を書く」。他の要素では出さない。 */
  onReply: () => void;
  /** もとになった記録をタップしたとき（その記録へ行く）。 */
  onOpenSource: (entryId: string) => void;
}

/** その人の言葉（言葉・抜粋・手紙）の書体。 */
const SERIF_FONT = "'Noto Serif JP', serif";

/**
 * 一覧の項目（言葉・抜粋・手紙）の中身を読むセミモーダル。
 *
 * Google マップのシートと同じで、**つまみで高さを変えられ、中がスクロールする**
 * （`BottomSheet`）。手紙は長いので最初から高い段で開き、言葉と抜粋は低い段から。
 * 以前は 76% 固定のシートで「6 割しか開かず調整もできない」と言われ、次に手紙だけ
 * 全画面にしたが、「セミモーダルで大きさを変えられるように」と直された。
 */
export function SpElementSheet({ element, onClose, onReply, onOpenSource }: SpElementSheetProps) {
  const t = useTranslations('sp.jar');

  const label =
    element.kind === 'letter'
      ? t('section_letter')
      : element.kind === 'keyword'
        ? t('section_keywords')
        : t('section_snippets');

  return (
    <div
      className="absolute inset-0 z-30"
      {...verifyAttrs({ unit: 'SpElementSheet', kind: element.kind, elementId: element.id })}
    >
      <BottomSheet
        open
        onClose={onClose}
        ariaLabel={label}
        label={label}
        closeLabel={t('close')}
        initialDetent={element.kind === 'letter' ? 1 : 0}
      >
        {element.kind === 'keyword' ? (
          <>
            <p className="text-2xl leading-snug" style={{ fontFamily: SERIF_FONT }}>
              {element.keyword}
            </p>
            {element.description ? (
              <p
                className="mt-3 whitespace-pre-wrap text-sm leading-loose opacity-80"
                style={{ fontFamily: SERIF_FONT }}
              >
                {element.description}
              </p>
            ) : null}
          </>
        ) : null}

        {element.kind === 'snippet' ? (
          <>
            <p
              className="whitespace-pre-wrap text-base leading-loose"
              style={{ fontFamily: SERIF_FONT }}
            >
              「{element.originalText}」
            </p>
            <p
              className="mt-2 text-[11px] tracking-[0.06em]"
              style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
            >
              {formatMonthDay(element.sourceDate)}
            </p>
            {element.selectionReason ? (
              <>
                <p
                  className="mt-5 mb-1.5 text-[11px] uppercase tracking-[0.14em]"
                  style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
                >
                  {t('selection_reason')}
                </p>
                <p
                  className="whitespace-pre-wrap text-sm leading-loose opacity-80"
                  style={{ fontFamily: SERIF_FONT }}
                >
                  {element.selectionReason}
                </p>
              </>
            ) : null}
          </>
        ) : null}

        {element.kind === 'letter' ? (
          <>
            <p
              className="whitespace-pre-wrap text-[16px]"
              style={{ fontFamily: SERIF_FONT, lineHeight: 2, color: 'var(--fg)' }}
            >
              {element.bodyText || t('letter_empty')}
            </p>

            {/* もとになった記録（Issue #453: 手紙だけ読んでも何への返事か分からなかった） */}
            {element.sources.length > 0 ? (
              <>
                <p
                  data-sources-heading
                  className="mt-8 mb-2 text-[11px] uppercase tracking-[0.14em]"
                  style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
                >
                  {t('section_sources')}
                </p>
                <ul className="m-0 flex list-none flex-col p-0">
                  {element.sources.map((source) => (
                    <li
                      key={source.id}
                      className="border-b"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenSource(source.id)}
                        className="flex min-h-[48px] w-full items-center gap-3 py-2.5 text-left"
                      >
                        <span
                          className="min-w-0 flex-1 truncate text-[15px]"
                          style={{ fontFamily: SERIF_FONT }}
                          data-source-title={source.title ? 'own' : 'fallback'}
                        >
                          {source.title || t('source_untitled')}
                        </span>
                        <span
                          className="shrink-0 text-[11px] tracking-[0.06em]"
                          style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                        >
                          {formatMonthDay(source.createdAt)}
                        </span>
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-[18px] leading-none"
                          style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                        >
                          ›
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <button
              type="button"
              onClick={onReply}
              className="mt-8 w-full rounded-full py-3 text-center text-sm font-medium text-white"
              style={{ ...CONTROL_FONT, background: 'var(--accent)' }}
            >
              {t('reply')}
            </button>
          </>
        ) : null}
      </BottomSheet>
    </div>
  );
}
