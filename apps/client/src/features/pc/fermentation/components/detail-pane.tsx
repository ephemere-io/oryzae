'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

/** 幅の下限。これ以上狭めると引用文が1行2〜3文字になり読めない。 */
const MIN_WIDTH = 320;
/** 幅の上限。広げすぎると背後のキャンバスが見えなくなる。 */
const MAX_WIDTH = 720;
const DEFAULT_WIDTH = 400;
/** キーボードで掴んだときの1回ぶんの移動量。 */
const KEY_STEP = 24;
const WIDTH_STORAGE_KEY = 'oryzae:jar-detail-pane-width';

function clampWidth(px: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(px)));
}

function readStoredWidth(): number | null {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampWidth(parsed) : null;
  } catch {
    // localStorage が使えない環境（プライベートモード等）では既定幅で動かす。
    return null;
  }
}

interface DetailPaneProps {
  open: boolean;
  onClose: () => void;
  questionId: string;
  questionText: string;
  type: 'keyword' | 'snippet' | 'letter' | null;
  data: {
    keyword?: string;
    description?: string;
    originalText?: string;
    sourceDate?: string;
    selectionReason?: string;
    bodyText?: string;
  } | null;
}

export function DetailPane({
  open,
  onClose,
  questionId,
  questionText,
  type,
  data,
}: DetailPaneProps) {
  const router = useRouter();
  const t = useTranslations('fermentation');

  // 初期値で localStorage を読まないのは SSR とハイドレーションで食い違うため。
  // マウント後に一度だけ復元する（キャンバスの視点保存と同じ考え方）。
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const stored = readStoredWidth();
    if (stored !== null) setWidth(stored);
  }, []);

  // ドラッグ中は毎フレーム setState が走るので、保存は確定時だけにする。
  const persistWidth = useCallback((next: number) => {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
    } catch {
      // 保存できなくても操作自体は成立させる。
    }
  }, []);

  // ドラッグ開始時の値。pointermove のたびに差分で幅を出す（累積誤差を避ける）。
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 左端の取っ手はキャンバスのパンより先に掴む。
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // 右端に固定された面なので、左へ動かすほど幅は増える。
    setWidth(clampWidth(drag.startWidth + (drag.startX - e.clientX)));
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsResizing(false);
    setWidth((current) => {
      persistWidth(current);
      return current;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 取っ手はポインタ専用にしない（キーボードだけでも幅を変えられるようにする）。
    const delta = e.key === 'ArrowLeft' ? KEY_STEP : e.key === 'ArrowRight' ? -KEY_STEP : 0;
    if (delta === 0) return;
    e.preventDefault();
    setWidth((current) => {
      const next = clampWidth(current + delta);
      persistWidth(next);
      return next;
    });
  };

  function handleWriteEntry() {
    router.push(`/entries/new?questionId=${questionId}`);
  }

  const headers: Record<'keyword' | 'snippet' | 'letter', string> = {
    keyword: t('detail.header_keyword'),
    snippet: t('detail.header_snippet'),
    letter: t('detail.header_letter'),
  };

  return (
    <div
      {...verifyAttrs({
        unit: 'DetailPane',
        open,
        type: type ?? 'none',
        hasData: Boolean(data),
        width,
        resizing: isResizing,
      })}
      className="fixed top-0 z-[60] flex h-full flex-col border-l border-[rgba(139,115,85,0.2)] bg-[#faf8f5]"
      style={{
        width,
        // 閉じているときは自分の幅ぶんだけ右に逃がす（幅が可変なので -400 固定にはできない）。
        right: open ? 0 : -width,
        // 掴んでいる間は追従を優先し、開閉のときだけ滑らせる。
        transition: isResizing ? 'none' : 'right 0.7s',
        backdropFilter: 'blur(12px)',
        fontFamily: "'Noto Serif JP', serif",
      }}
    >
      {/* 幅を変える取っ手（左端）。 */}
      {/* biome-ignore lint/a11y/useSemanticElements: <hr> は分割線であって掴める仕切りではない。
          これは WAI-ARIA の Window Splitter（focusable な separator + aria-valuenow）で、
          void 要素の <hr> ではポインタ/キーボードの取っ手として成立しない。 */}
      <div
        data-verify-part="resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('detail.resize_aria')}
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        style={{ backgroundColor: isResizing ? 'rgba(74,158,142,0.35)' : 'transparent' }}
      />

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('detail.close_aria')}
        className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6b5c4a] hover:bg-[rgba(139,115,85,0.1)]"
      >
        ×
      </button>

      {/* Question */}
      <div className="shrink-0 px-8 pt-8 pb-3 text-sm font-medium text-[#4a3f35]">
        {questionText}
      </div>

      {/* Header */}
      <div className="shrink-0 border-b border-[rgba(139,115,85,0.1)] px-8 pb-5 text-[22px] font-medium text-[#4a3f35]">
        {type ? headers[type] : ''}
      </div>

      {/* Body — scrollable */}
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
            <p className="mb-4 text-xs text-[var(--date-color)]">
              <span>{t('detail.snippet_source_prefix')}</span> {data.sourceDate}
            </p>
            <p>{data.selectionReason}</p>
          </>
        )}
        {type === 'letter' && data && <div className="whitespace-pre-wrap">{data.bodyText}</div>}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[rgba(139,115,85,0.1)] px-8 py-6">
        <button
          type="button"
          onClick={handleWriteEntry}
          className="w-full rounded-lg border border-[var(--accent)] px-4 py-3 text-sm text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white"
        >
          {t('detail.write_entry')}
        </button>
      </div>
    </div>
  );
}
