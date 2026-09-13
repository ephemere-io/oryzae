'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { type DockDetent, DockSheet } from '@/components/ui/dock-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { CONTROL_FONT } from '@/components/ui/surface';
import type { FermentationDetail } from '@/features/shared/fermentation/types';

interface SpFermentationDockProps {
  open: boolean;
  detent: DockDetent;
  onDetentChange: (detent: DockDetent) => void;
  /** 覗く段を押したとき（本文からフォーカスを外す）。 */
  onPeekTap?: () => void;
  /** 見ている問い（覗く段の 1 行）。 */
  questionText: string;
  detail: FermentationDetail | null;
  loading: boolean;
}

const MAX_KEYWORDS = 6;
const MAX_SNIPPETS_HALF = 3;

/**
 * 発酵の結果を**見ながら書く**ためのドック（SP）。
 *
 * PC では手紙・言葉・抜粋が本文の横に居て、目だけが行き来する。スマホには横が無いので、往復は上下で
 * 作る: 本文の下に非モーダルの `DockSheet`。
 * - **覗く**（1 行）: 問いと、いちばん目立つ言葉。書いている間（キーボードが出ている間）はここ
 * - **半分**: 手紙の冒頭・言葉の chips・抜粋 3 件。本文の上半分は見えたまま
 * - **全画面**: 手紙の全文と抜粋の全文
 * 覗く段を押せば半分へ（読む）、本文を押せばまた覗く段へ（書く）。消すのはパレットの「発酵の結果」。
 */
export function SpFermentationDock({
  open,
  detent,
  onDetentChange,
  onPeekTap,
  questionText,
  detail,
  loading,
}: SpFermentationDockProps) {
  const t = useTranslations('editor.fermentation_sidebar');
  const tSp = useTranslations('sp.editor');
  const [openKeyword, setOpenKeyword] = useState<string | null>(null);
  const [openSnippet, setOpenSnippet] = useState<string | null>(null);

  const keywords = detail?.keywords.slice(0, MAX_KEYWORDS) ?? [];
  const snippets = detail?.snippets ?? [];
  const shownSnippets = detent === 'full' ? snippets : snippets.slice(0, MAX_SNIPPETS_HALF);
  const letter = detail?.letter?.bodyText ?? null;
  const empty =
    !loading &&
    (detail === null || (keywords.length === 0 && snippets.length === 0 && letter === null));
  const headline = keywords[0]?.keyword ?? null;

  return (
    <DockSheet
      open={open}
      detent={detent}
      onDetentChange={onDetentChange}
      onPeekTap={onPeekTap}
      ariaLabel={t('heading')}
      peek={
        <span
          className="flex w-full min-w-0 items-center gap-2"
          {...verifyAttrs({
            unit: 'SpFermentationDock',
            detent,
            loading,
            empty,
            keywordCount: keywords.length,
            snippetCount: snippets.length,
            hasLetter: letter !== null,
          })}
        >
          <span
            className="shrink-0 text-[11px] uppercase tracking-[0.14em]"
            style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
          >
            {t('heading')}
          </span>
          {loading ? (
            <Skeleton className="h-3 w-32 rounded-full" />
          ) : (
            <span className="min-w-0 truncate text-[13px]" style={{ color: 'var(--fg)' }}>
              {empty ? t('empty') : (headline ?? questionText)}
            </span>
          )}
        </span>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-3 pt-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : empty ? (
        <p className="pt-2 text-[13px] opacity-60">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-5 pt-1">
          <p
            className="truncate text-[12px]"
            style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
          >
            {questionText}
          </p>

          {letter !== null ? (
            <Section label={t('section_letter')}>
              <p
                className={`whitespace-pre-wrap text-[14px] leading-[1.9] ${detent === 'full' ? '' : 'line-clamp-4'}`}
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                {letter}
              </p>
              {detent !== 'full' ? (
                <button
                  type="button"
                  onClick={() => onDetentChange('full')}
                  className="mt-1 self-start py-1 text-[13px]"
                  style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
                >
                  {tSp('result_read_full')}
                </button>
              ) : null}
            </Section>
          ) : null}

          {keywords.length > 0 ? (
            <Section label={t('section_keywords')}>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <button
                    key={kw.id}
                    type="button"
                    aria-pressed={openKeyword === kw.id}
                    onClick={() => setOpenKeyword((prev) => (prev === kw.id ? null : kw.id))}
                    className="min-h-[36px] rounded-full px-3 text-[13px]"
                    style={{
                      ...CONTROL_FONT,
                      background:
                        openKeyword === kw.id
                          ? 'var(--accent)'
                          : 'linear-gradient(135deg, #E8D1B5, #D9B48F)',
                      color: openKeyword === kw.id ? 'var(--bg)' : 'var(--fg)',
                    }}
                  >
                    {kw.keyword}
                  </button>
                ))}
              </div>
              {openKeyword ? (
                <p className="mt-2 text-[13px] leading-relaxed opacity-75">
                  {keywords.find((kw) => kw.id === openKeyword)?.description}
                </p>
              ) : null}
            </Section>
          ) : null}

          {shownSnippets.length > 0 ? (
            <Section label={t('section_snippets')}>
              <ul className="flex flex-col gap-2">
                {shownSnippets.map((snippet) => {
                  const opened = openSnippet === snippet.id;
                  return (
                    <li key={snippet.id}>
                      <button
                        type="button"
                        aria-expanded={opened}
                        onClick={() => setOpenSnippet(opened ? null : snippet.id)}
                        className="w-full rounded-xl border px-3 py-2.5 text-left"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <span
                          className={`block text-[13px] leading-relaxed ${opened || detent === 'full' ? '' : 'line-clamp-3'}`}
                          style={{ fontFamily: "'Noto Serif JP', serif" }}
                        >
                          {snippet.originalText}
                        </span>
                        <span
                          className="mt-1 block text-[11px]"
                          style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                        >
                          {snippet.sourceDate.slice(0, 10)}
                        </span>
                      </button>
                      {opened ? (
                        <p className="mt-1.5 px-1 text-[12px] leading-relaxed opacity-75">
                          {snippet.selectionReason}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {detent !== 'full' && snippets.length > shownSnippets.length ? (
                <button
                  type="button"
                  onClick={() => onDetentChange('full')}
                  className="mt-1 self-start py-1 text-[13px]"
                  style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
                >
                  {tSp('result_read_full')}
                </button>
              ) : null}
            </Section>
          ) : null}
        </div>
      )}
    </DockSheet>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <span
        className="mb-1.5 text-[11px] uppercase tracking-[0.12em]"
        style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
      >
        {label}
      </span>
      {children}
    </section>
  );
}
