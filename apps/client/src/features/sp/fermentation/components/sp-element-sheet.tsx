'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { ScannedEntry } from '@/features/shared/fermentation/types';
import { formatMonthDay } from '@/lib/format-date';

/** 開いた円の中でタップできるもの。中身はすべてここで読む。 */
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

/**
 * 円の中の要素（言葉・抜粋・手紙）の中身を読むボトムシート。
 *
 * 円の中の見た目は「そこに在る」ことだけを示し、**読むのは必ずここ**。小さな円の中に
 * 本文を詰めると、どれも読めないまま重なるだけになる。
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
      className="absolute inset-0 z-30 flex flex-col justify-end"
      {...verifyAttrs({ unit: 'SpElementSheet', kind: element.kind, elementId: element.id })}
    >
      {/* 背景。タップで閉じる（シートの外は「戻る」）。 */}
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="sp-fade absolute inset-0"
        style={{ background: 'color-mix(in srgb, var(--fg) 28%, transparent)' }}
      />

      <div
        className="sp-sheet relative max-h-[76%] overflow-auto rounded-t-3xl px-6 pt-5 pb-8"
        style={{
          background: 'var(--bg)',
          boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
          fontFamily: 'var(--ob-font-serif)',
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ color: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
          >
            {label}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs"
            style={{ color: 'var(--date-color)' }}
          >
            {t('close')}
          </button>
        </div>

        {element.kind === 'keyword' ? (
          <>
            <p className="text-2xl leading-snug">{element.keyword}</p>
            {element.description ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-loose opacity-80">
                {element.description}
              </p>
            ) : null}
          </>
        ) : null}

        {element.kind === 'snippet' ? (
          <>
            <p className="whitespace-pre-wrap text-base leading-loose">
              「{element.originalText}」
            </p>
            <p className="mt-2 text-[11px]" style={{ color: 'var(--date-color)' }}>
              {formatMonthDay(element.sourceDate)}
            </p>
            {element.selectionReason ? (
              <>
                <p
                  className="mt-5 mb-1.5 text-[11px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
                >
                  {t('selection_reason')}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-loose opacity-80">
                  {element.selectionReason}
                </p>
              </>
            ) : null}
          </>
        ) : null}

        {element.kind === 'letter' ? (
          <>
            <p className="whitespace-pre-wrap text-base leading-loose">
              {element.bodyText || t('letter_empty')}
            </p>

            {/* もとになった記録（Issue #453: 手紙だけ読んでも何への返事か分からなかった） */}
            {element.sources.length > 0 ? (
              <>
                <p
                  data-sources-heading
                  className="mt-6 mb-2 text-[11px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
                >
                  {t('section_sources')}
                </p>
                <ul className="flex flex-col gap-2">
                  {element.sources.map((source) => (
                    <li key={source.id}>
                      <button
                        type="button"
                        onClick={() => onOpenSource(source.id)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left"
                        style={{
                          background: 'var(--ob-card-bg)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span
                          className="min-w-0 flex-1 truncate text-sm"
                          data-source-title={source.title ? 'own' : 'fallback'}
                        >
                          {source.title || t('source_untitled')}
                        </span>
                        <span
                          className="shrink-0 text-[11px]"
                          style={{ color: 'var(--date-color)' }}
                        >
                          {formatMonthDay(source.createdAt)}
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
              className="mt-6 w-full rounded-full py-3 text-center text-sm font-medium text-white"
              style={{ background: 'var(--accent)', fontFamily: 'var(--ob-font-sans)' }}
            >
              {t('reply')}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
