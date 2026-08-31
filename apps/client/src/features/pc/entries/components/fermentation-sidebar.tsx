'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ICON_STROKE_WIDTH, SHELL_INSET } from '@/components/ui/surface';
import {
  type FermentationOverlayDetailData,
  FermentationOverlayDetailPane,
  type FermentationOverlayDetailType,
} from '@/features/pc/entries/components/fermentation-overlay-detail-pane';
import type { FermentationDetail } from '@/features/shared/fermentation/types';

interface FermentationSidebarProps {
  detail: FermentationDetail;
  onClose: () => void;
}

const MAX_KEYWORDS = 5;
const MAX_SNIPPETS = 3;
const SNIPPET_PREVIEW_LENGTH = 60;

/**
 * エントリー画面の発酵結果サイドバー（Issue #466）。
 *
 * エントリーは「テキストのロジックに他のオブジェクトが従う世界」（docs/entry-screen-design.md §1）
 * なので、本文の流れを乱すものは本文に置かない。手紙・キーワード・スニペットはここに集約し、
 * 本文は先頭から末尾まで途切れないようにする。
 *
 * ## レイアウトの決め方
 *
 * この面は**過去から届いたもの**を置く場所で、いま書いている本文とは時間が違う。
 * だから本文と同じ紙には見せない: 一段沈んだ地の上に、届いたものが順に積んである形にする。
 *
 * - 上端の余白と行の間隔は、左のサイドバー・ヘッダーと同じ 20px 系（SHELL_INSET）で刻む。
 *   画面に3本の別々の余白の物差しがあると、どこを見ても落ち着かない。
 * - 並び順は**手紙 → ことば → 断片**。長い読みものが上、拾い読みするものが下。
 * - 見出しは面の中で唯一の小さな大文字。区切り線は引かず、余白でまとまりを作る
 *   （設定パネルと同じ作法）。
 */
export function FermentationSidebar({ detail, onClose }: FermentationSidebarProps) {
  const t = useTranslations('editor.fermentation_sidebar');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<FermentationOverlayDetailType | null>(null);
  const [detailData, setDetailData] = useState<FermentationOverlayDetailData | null>(null);

  function openDetail(type: FermentationOverlayDetailType, data: FermentationOverlayDetailData) {
    setDetailType(type);
    setDetailData(data);
    setDetailOpen(true);
  }

  const keywords = detail.keywords.slice(0, MAX_KEYWORDS);
  const snippets = detail.snippets.slice(0, MAX_SNIPPETS);
  const isEmpty = keywords.length === 0 && snippets.length === 0 && detail.letter === null;

  return (
    <>
      <aside
        className="flex w-72 shrink-0 flex-col overflow-y-auto border-l"
        style={{
          paddingTop: SHELL_INSET,
          paddingBottom: SHELL_INSET,
          borderColor: 'var(--border-subtle)',
          background: 'color-mix(in srgb, var(--bg) 94%, var(--fg))',
        }}
        {...verifyAttrs({
          unit: 'FermentationSidebar',
          keywordCount: keywords.length,
          snippetCount: snippets.length,
          hasLetter: detail.letter !== null,
          empty: isEmpty,
          detailOpen,
        })}
      >
        {/* 見出しの行。左のサイドバーの項目と同じ高さの箱に載せず、面の始まりを示すだけの
            細い一行にする（この面の主役は中身であって、見出しではない）。 */}
        <div className="mb-5 flex h-5 items-center justify-between px-5">
          <span className="text-[11px] font-medium tracking-[0.12em] text-[var(--fg)] opacity-45">
            {t('heading')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close_aria')}
            className="-mr-1.5 flex h-6 w-6 items-center justify-center rounded-md text-[var(--date-color)] transition-colors hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={ICON_STROKE_WIDTH}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {isEmpty && (
          <p className="px-5 text-[13px] leading-relaxed text-[var(--date-color)]">{t('empty')}</p>
        )}

        {/* 手紙。この面でいちばん長く読むものなので、いちばん上に、いちばん大きく置く。 */}
        {detail.letter && (
          <Section label={t('section_letter')}>
            <button
              type="button"
              onClick={() =>
                openDetail('letter', { bodyText: detail.letter ? detail.letter.bodyText : '' })
              }
              className="w-full rounded-lg border px-3.5 py-3 text-left text-[13px] leading-relaxed transition-transform hover:-translate-y-px"
              style={{
                borderColor: 'rgba(217, 180, 143, 0.5)',
                background: 'rgba(247, 240, 230, 0.55)',
                color: 'var(--fg)',
                fontFamily: "'Noto Serif JP', serif",
              }}
            >
              {t('letter_open')}
            </button>
          </Section>
        )}

        {keywords.length > 0 && (
          <Section label={t('section_keywords')}>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw) => (
                <button
                  key={kw.id}
                  type="button"
                  onClick={() =>
                    openDetail('keyword', { keyword: kw.keyword, description: kw.description })
                  }
                  className="flex h-7 items-center rounded-full px-3 text-[12px] transition-transform hover:-translate-y-px"
                  style={{
                    background: 'linear-gradient(135deg, #E8D1B5, #D9B48F)',
                    border: '1px solid rgba(255,255,255,0.5)',
                    color: 'var(--fg)',
                    fontFamily: "'Noto Serif JP', serif",
                    letterSpacing: '0.08em',
                  }}
                >
                  {kw.keyword}
                </button>
              ))}
            </div>
          </Section>
        )}

        {snippets.length > 0 && (
          <Section label={t('section_snippets')}>
            <div className="flex flex-col gap-2">
              {snippets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    openDetail('snippet', {
                      originalText: s.originalText,
                      sourceDate: s.sourceDate,
                      selectionReason: s.selectionReason,
                    })
                  }
                  // 断片は自分が過去に書いた文なので、本文と同じ明朝で、引用のように
                  // 左の罫だけを持たせる（面の中で唯一の線）。
                  className="border-l-2 py-1 pl-3 text-left text-[12px] leading-relaxed text-[var(--fg)] transition-colors hover:border-[var(--accent)]"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    fontFamily: "'Noto Serif JP', serif",
                  }}
                >
                  {s.originalText.length > SNIPPET_PREVIEW_LENGTH
                    ? `${s.originalText.substring(0, SNIPPET_PREVIEW_LENGTH)}…`
                    : s.originalText}
                </button>
              ))}
            </div>
          </Section>
        )}
      </aside>

      <FermentationOverlayDetailPane
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        type={detailType}
        data={detailData}
      />
    </>
  );
}

/**
 * まとまり。設定パネルの Section と同じ作法（小さく薄い見出し1行 + 余白で区切る）。
 * 左右の余白は面全体で 20px に揃える。
 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col px-5 pb-7 last:pb-0">
      <div className="mb-2 flex h-5 items-center">
        <span className="text-[11px] tracking-[0.04em] text-[var(--fg)] opacity-40">{label}</span>
      </div>
      {children}
    </section>
  );
}
