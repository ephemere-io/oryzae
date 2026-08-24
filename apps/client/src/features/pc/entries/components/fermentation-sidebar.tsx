'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
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
 * 従来の FermentationOverlay（本文の上に浮かぶドラッグ可能な要素群, Issue #329）を置き換える。
 * 詳細ペインは従来と同じ FermentationOverlayDetailPane を再利用する。
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
        className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-[var(--border-subtle)] px-3 py-3"
        style={{ background: 'color-mix(in srgb, var(--bg) 96%, var(--fg))' }}
        {...verifyAttrs({
          unit: 'FermentationSidebar',
          keywordCount: keywords.length,
          snippetCount: snippets.length,
          hasLetter: detail.letter !== null,
          empty: isEmpty,
          detailOpen,
        })}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-[var(--date-color)]">
            {t('heading')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close_aria')}
            className="rounded p-0.5 text-[var(--date-color)] transition-colors hover:text-[var(--fg)]"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {isEmpty && <p className="py-4 text-xs text-[var(--date-color)]">{t('empty')}</p>}

        {detail.letter && (
          <Section label={t('section_letter')}>
            <button
              type="button"
              onClick={() =>
                openDetail('letter', { bodyText: detail.letter ? detail.letter.bodyText : '' })
              }
              className="w-full rounded-md border px-2.5 py-2 text-left text-xs leading-relaxed transition-colors"
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
                  className="rounded-full px-2.5 py-1 text-[11px] transition-transform hover:-translate-y-px"
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
            <div className="flex flex-col gap-1.5">
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
                  className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-2 text-left text-[11px] leading-relaxed text-[var(--fg)] transition-colors hover:bg-[var(--toolbar-hover)]"
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <div className="mb-1.5 text-[10px] tracking-wider text-[var(--date-color)]">{label}</div>
      {children}
    </section>
  );
}
