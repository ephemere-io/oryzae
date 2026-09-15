'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { type DockDetent, DockSheet } from '@/components/ui/dock-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { CONTROL_FONT } from '@/components/ui/surface';
import { FermentationReading } from '@/features/shared/fermentation/components/fermentation-reading';
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

/**
 * 発酵の結果を**見ながら書く**ためのドック（SP）。
 *
 * PC では手紙・言葉・抜粋が本文の横に居て、目だけが行き来する。スマホには横が無いので、往復は上下で
 * 作る: 本文の下に非モーダルの `DockSheet`。
 * - **覗く**（1 行）: 問いと、いちばん目立つ言葉。書いている間（キーボードが出ている間）はここ
 * - **半分**: 本文の上半分は見えたまま、手紙・言葉（説明つき）・抜粋（理由つき）を読む
 * - **全画面**: そのまま同じ指で下へ読み進める
 * 中身は段で変えない（段ごとに高さが変わると、スクロールの途中で伸び縮みして吸着がやり直しになる）。
 * 中身は瓶の問いの画面と同じ `FermentationReading`（キーワードの説明とスニペットの理由は最初から出す）。
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

  const keywords = detail?.keywords ?? [];
  const snippets = detail?.snippets ?? [];
  const letter = detail?.letter?.bodyText ?? null;
  const empty =
    !loading &&
    (detail === null || (keywords.length === 0 && snippets.length === 0 && letter === null));

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
              {/* 何の結果かは問いで言う。先頭のキーワードを出していた頃は「なぜその言葉？」になった（レビュー）。 */}
              {empty ? t('empty') : questionText}
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
      ) : detail ? (
        <div className="flex flex-col gap-4 pt-1">
          {/* 瓶の問いの画面と同じ読む流れ（字と見出しを揃える。返事と出典は書いている最中なので出さない）。 */}
          <FermentationReading detail={detail} />
        </div>
      ) : null}
    </DockSheet>
  );
}
