'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
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

/**
 * 発酵の結果を**見ながら書く**ためのドック（SP）。
 *
 * PC では手紙・言葉・抜粋が本文の横に居て、目だけが行き来する。スマホには横が無いので、往復は上下で
 * 作る: 本文の下に非モーダルの `DockSheet`。
 * - **覗く**（1 行）: 問いと、いちばん目立つ言葉。書いている間（キーボードが出ている間）はここ
 * - **半分**: 本文の上半分は見えたまま、手紙・言葉（説明つき）・抜粋（理由つき）を読む
 * - **全画面**: そのまま同じ指で下へ読み進める
 * 中身は段で変えない（段ごとに高さが変わると、スクロールの途中で伸び縮みして吸着がやり直しになる）。
 * 言葉の説明と抜粋の理由は**最初から出す**（押して出す段を作らない。実機レビュー）。
 * 覗く段を押せば半分へ（読む）、本文を押せばまた覗く段へ（書く）。出す／消すはパレットの「発酵の結果」。
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

  const keywords = detail?.keywords.slice(0, MAX_KEYWORDS) ?? [];
  const snippets = detail?.snippets ?? [];
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
      contract={verifyAttrs({
        unit: 'SpFermentationDock',
        detent,
        loading,
        empty,
        keywordCount: keywords.length,
        snippetCount: snippets.length,
        hasLetter: letter !== null,
      })}
      peek={
        <span className="flex w-full min-w-0 items-center gap-2">
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
                className="whitespace-pre-wrap text-[14px] leading-[1.9]"
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
              <ul className="flex flex-col gap-2.5">
                {keywords.map((kw) => (
                  <li key={kw.id} className="flex flex-col gap-0.5">
                    <span
                      className="self-start rounded-full px-3 py-1 text-[13px]"
                      style={{
                        ...CONTROL_FONT,
                        background: 'linear-gradient(135deg, #E8D1B5, #D9B48F)',
                        color: 'var(--fg)',
                      }}
                    >
                      {kw.keyword}
                    </span>
                    {kw.description ? (
                      <span className="px-1 text-[13px] leading-relaxed opacity-75">
                        {kw.description}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {snippets.length > 0 ? (
            <Section label={t('section_snippets')}>
              <ul className="flex flex-col gap-2">
                {snippets.map((snippet) => (
                  <li
                    key={snippet.id}
                    data-snippet
                    className="rounded-xl border px-3 py-2.5"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{ fontFamily: "'Noto Serif JP', serif" }}
                    >
                      {snippet.originalText}
                    </p>
                    {snippet.selectionReason ? (
                      <p className="mt-1.5 text-[12px] leading-relaxed opacity-70">
                        {snippet.selectionReason}
                      </p>
                    ) : null}
                    <p
                      className="mt-1 text-[11px]"
                      style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
                    >
                      {snippet.sourceDate.slice(0, 10)}
                    </p>
                  </li>
                ))}
              </ul>
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
