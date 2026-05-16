'use client';

import { useTranslations } from 'next-intl';

export type FermentationOverlayDetailType = 'keyword' | 'snippet' | 'letter';

export interface FermentationOverlayDetailData {
  keyword?: string;
  description?: string;
  originalText?: string;
  sourceDate?: string;
  selectionReason?: string;
  bodyText?: string;
}

interface FermentationOverlayDetailPaneProps {
  open: boolean;
  onClose: () => void;
  type: FermentationOverlayDetailType | null;
  data: FermentationOverlayDetailData | null;
}

/**
 * Issue #329: 発酵オーバーレイ上のキーワード／スニペット／レターをクリックしたときに右側に
 * スライドインする詳細ペイン。Jar 画面の DetailPane と挙動を揃えるが、エントリ編集中の
 * オーバーレイから開かれるため "エントリを書く" ボタンは不要。
 */
export function FermentationOverlayDetailPane({
  open,
  onClose,
  type,
  data,
}: FermentationOverlayDetailPaneProps) {
  const t = useTranslations('editor.fermentation_overlay.detail');

  const headers: Record<FermentationOverlayDetailType, string> = {
    keyword: t('header_keyword'),
    snippet: t('header_snippet'),
    letter: t('header_letter'),
  };

  return (
    <div
      className="fixed top-0 z-[65] flex h-full w-[400px] flex-col border-l border-[rgba(139,115,85,0.2)] bg-[#faf8f5] transition-[right] duration-500"
      style={{
        right: open ? 0 : -400,
        backdropFilter: 'blur(12px)',
        fontFamily: "'Noto Serif JP', serif",
      }}
      aria-hidden={!open}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6b5c4a] hover:bg-[rgba(139,115,85,0.1)]"
        aria-label={t('close_aria')}
      >
        ×
      </button>

      <div className="shrink-0 border-b border-[rgba(139,115,85,0.1)] px-8 pt-12 pb-5 text-[22px] font-medium text-[#4a3f35]">
        {type ? headers[type] : ''}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 text-sm leading-[2.0] text-[#4a3f35]">
        {type === 'keyword' && data && (
          <>
            <h3 className="mb-3 text-lg font-medium text-[var(--accent)]">{data.keyword}</h3>
            <p>{data.description}</p>
          </>
        )}
        {type === 'snippet' && data && (
          <>
            <blockquote className="mb-4 text-base font-medium leading-relaxed">
              「{data.originalText}」
            </blockquote>
            {data.sourceDate && (
              <p className="mb-4 text-xs text-[var(--date-color)]">
                <span>{t('snippet_source_prefix')}</span> {data.sourceDate}
              </p>
            )}
            <p>{data.selectionReason}</p>
          </>
        )}
        {type === 'letter' && data && <div className="whitespace-pre-wrap">{data.bodyText}</div>}
      </div>
    </div>
  );
}
