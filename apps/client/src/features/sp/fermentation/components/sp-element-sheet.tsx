'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { ScannedEntry } from '@/features/shared/fermentation/types';
import { formatMonthDay } from '@/lib/format-date';

/** 開いた円のリストでタップできるもの。中身はすべてここで読む。 */
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

/** 「閉じる」の枠ボタン。4 か所で同じ形（§50: 灰色の文字だけでは押せるものに見えなかった）。 */
const CLOSE_BUTTON_CLASS = 'min-h-[40px] shrink-0 rounded-full border px-4 text-[13px]';
const CLOSE_BUTTON_STYLE = {
  ...CONTROL_FONT,
  color: 'var(--fg)',
  borderColor: 'var(--border-subtle)',
} as const;

/**
 * 円の中の要素（言葉・抜粋・手紙）の中身を読む面。
 *
 * - **言葉と抜粋はボトムシート。** 数行で読み切れるので、下から出して外を押せば戻る
 * - **手紙は全画面の読み面。** 以前は 76% のシートで、長い手紙は中でスクロールし、
 *   ハンドルも段階も無く「6 割しか開かず読みにくい」と報告された。手紙は読み物なので
 *   1 枚の面にし、「もとになったエントリー」と「返事を書く」も本文の流れの中に置く
 */
export function SpElementSheet({ element, onClose, onReply, onOpenSource }: SpElementSheetProps) {
  const t = useTranslations('sp.jar');

  if (element.kind === 'letter') {
    return (
      <div
        className="sp-rise absolute inset-0 z-30 flex flex-col"
        style={{ background: 'var(--bg)' }}
        {...verifyAttrs({ unit: 'SpElementSheet', kind: element.kind, elementId: element.id })}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 px-5 py-4">
          <span
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
          >
            {t('section_letter')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className={CLOSE_BUTTON_CLASS}
            style={CLOSE_BUTTON_STYLE}
          >
            {t('close')}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-10">
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
          {/* 読み終えた場所にも戻り道を置く（上端まで戻らせない）。 */}
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full py-3 text-center text-[13px]"
            style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
          >
            {t('close')}
          </button>
        </div>
      </div>
    );
  }

  const label = element.kind === 'keyword' ? t('section_keywords') : t('section_snippets');

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
        style={{ background: 'var(--bg)', boxShadow: '0 -8px 32px rgba(140,133,126,0.18)' }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
          >
            {label}
          </span>
          <button
            type="button"
            onClick={onClose}
            className={CLOSE_BUTTON_CLASS}
            style={CLOSE_BUTTON_STYLE}
          >
            {t('close')}
          </button>
        </div>

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
        ) : (
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
        )}
      </div>
    </div>
  );
}
