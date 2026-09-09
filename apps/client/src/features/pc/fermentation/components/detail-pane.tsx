'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEscapeKey } from '@/lib/use-escape-key';

/**
 * 詳細列の幅（px）。
 *
 * **中身の種類では変えない。** 言葉・抜粋・手紙を渡り歩くのがこの面の主な使われ方なので、
 * 種類ごとに変えると隣のキャンバス列が選ぶたびに伸び縮みして、円の位置が動く。
 * 変えるのは**人が掴んだとき**だけ。
 *
 * 既定の 480px は、左右の余白 64px を引いて実質 416px ＝ 14px の和文で 1 行 30 文字前後。
 * 読める行長の下限あたりなので、長い手紙を読む人は広げられた方がよい。
 */
const DEFAULT_WIDTH = 480;
/** これ以上狭めると引用文が 1 行 2〜3 文字になり読めない。 */
const MIN_WIDTH = 360;
/** これ以上広げるとキャンバス列に円盤の扇が置けなくなる。 */
const MAX_WIDTH = 760;
/** キーボードで掴んだときの 1 回ぶんの移動量。 */
const KEY_STEP = 24;
const WIDTH_STORAGE_KEY = 'oryzae:jar-detail-column-width';

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
  /** 詳細列そのものを出すか。円を開いている / 履歴を見ている間はずっと出しておく。 */
  visible: boolean;
  /** 中身が選ばれているか。false なら列は出たまま空状態を見せる。 */
  open: boolean;
  onClose: () => void;
  questionId: string;
  /**
   * どの回のものか（`2026-06-28 の発酵`）。**問いは入れない。**
   *
   * 問いは画面上部に 1 か所だけ出す。以前はここにも重ねていたが、円周を回る問い・上部の
   * 見出し・この行の 3 か所で同じ文が出ていた（レビュー指摘）。空文字なら行ごと出さない。
   */
  contextLabel: string;
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

/**
 * 発酵の中身（言葉・抜粋・手紙）を読むための列。円の隣に並べる。
 *
 * 一度は画面中央のモーダルにしたが、**要素を渡り歩けなくなる**のでやめた。手紙を読んで
 * から抜粋が気になっても、いったんモーダルを閉じないと円に触れない ── 切り替えのたびに
 * クリックが 2 倍になっていた（レビューでの指摘）。読む面と選ぶ面は同時に見えていないと
 * いけない。
 *
 * かといって以前のように盤面へ**覆いかぶせる**のも違う。あれは右側の円盤や円を隠して
 * いた。列として並べれば、キャンバス側は覆われるのではなく **狭くなる** ので、円は
 * 隠れないまま隣で開き続けられる。
 *
 * ⚠️ エディタ側の発酵オーバーレイ（`pc/entries/fermentation-overlay-detail-pane`）とは
 * 別物のまま。あちらは本文を書いている最中に開くので、書く手元を覆ってはいけない。
 */
export function DetailPane({
  visible,
  open,
  onClose,
  questionId,
  contextLabel,
  type,
  data,
}: DetailPaneProps) {
  const router = useRouter();
  const t = useTranslations('fermentation');

  // 初期値で localStorage を読まないのは SSR とハイドレーションで食い違うため。
  // マウント後に一度だけ復元する（キャンバスの視点保存と同じ考え方）。
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // 確定時に「いまの幅」を読むための鏡。setState の updater は純粋でなければならず
  // （StrictMode では 2 回呼ばれる）、その中で保存すると二重に書く。
  const widthRef = useRef(DEFAULT_WIDTH);

  const applyWidth = useCallback((next: number) => {
    widthRef.current = next;
    setWidth(next);
  }, []);

  useEffect(() => {
    const stored = readStoredWidth();
    if (stored !== null) applyWidth(stored);
  }, [applyWidth]);

  // 掴んでいる間は毎フレーム変わるので、保存は離したときだけ。
  const persistWidth = useCallback((next: number) => {
    try {
      window.localStorage.setItem(WIDTH_STORAGE_KEY, String(next));
    } catch {
      // 保存できなくても操作自体は成立させる。
    }
  }, []);

  // 掴み始めた時点の値。pointermove のたびに差分で出す（累積誤差を避ける）。
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: widthRef.current };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // 右端に固定された列なので、左へ動かすほど幅は増える。
    applyWidth(clampWidth(drag.startWidth + (drag.startX - e.clientX)));
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsResizing(false);
    persistWidth(widthRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 取っ手はポインタ専用にしない（キーボードだけでも幅を変えられるようにする）。
    const delta = e.key === 'ArrowLeft' ? KEY_STEP : e.key === 'ArrowRight' ? -KEY_STEP : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = clampWidth(widthRef.current + delta);
    applyWidth(next);
    persistWidth(next);
  };

  // Escape で選択を解く。列そのものは残る（円を閉じるまでが列の寿命）。
  // 発酵履歴側の Escape は、中身が選ばれている間だけ止めてある ── 1 回目でここ、
  // 2 回目で履歴、という順に閉じてほしいため。
  const handleEscape = useCallback(() => onClose(), [onClose]);
  useEscapeKey(open, handleEscape);

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
        visible,
        open,
        type: type ?? 'none',
        hasData: Boolean(data),
        width,
        resizing: isResizing,
      })}
      className="relative z-[40] flex h-full shrink-0 flex-col overflow-hidden border-l border-[rgba(139,115,85,0.2)] bg-[#faf8f5]"
      style={{
        // 閉じるときは幅を 0 へ畳む。キャンバス列がそのぶん広がって円が中央へ戻る。
        width: visible ? width : 0,
        // 掴んでいる間は追従を優先し、開閉のときだけ滑らせる。
        transition: isResizing ? 'none' : 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: "'Noto Serif JP', serif",
      }}
    >
      {/* 幅を変える取っ手（左端）。畳んでいる間も置いたままにして、不活性にするだけに
          する（条件レンダリングにすると biome の suppression が要素に付かなくなる）。 */}
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
        tabIndex={visible ? 0 : -1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        style={{
          backgroundColor: isResizing ? 'rgba(74,158,142,0.35)' : 'transparent',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      />

      {/* 中身は幅が変わっても折り返さない。畳んでいる途中で文字が潰れるのを防ぐ。 */}
      <div className="flex h-full flex-col" style={{ width }}>
        {open ? (
          <>
            {/* Close（選択を解くだけ。列は残る） */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('detail.close_aria')}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6b5c4a] transition-colors hover:bg-[rgba(139,115,85,0.1)]"
            >
              ×
            </button>

            {/* どの回のものか（履歴を見ているときだけ）。問いは画面上部に 1 か所。 */}
            {contextLabel ? (
              <div
                data-verify-part="context"
                className="shrink-0 px-8 pt-8 pr-16 pb-3 text-[11px] tracking-[0.14em] text-[var(--date-color)]"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {contextLabel}
              </div>
            ) : (
              <div className="shrink-0 pt-8" />
            )}

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
              {type === 'letter' && data && (
                <div className="whitespace-pre-wrap">{data.bodyText}</div>
              )}
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
          </>
        ) : (
          /* 空状態。列は円を開いた時点で現れるので、選ぶ前のここに「何をすると何が出るか」
             を置いておく。列が空のまま無言だと、ただ狭くなっただけに見える。 */
          <div
            data-verify-part="empty"
            className="flex h-full flex-col items-center justify-center gap-3 px-10 text-center"
          >
            <span
              className="text-[9px] uppercase tracking-[0.3em] text-[var(--date-color)]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {t('detail.empty_label')}
            </span>
            <span className="text-[13px] leading-[2] text-[var(--date-color)]">
              {t('detail.empty_hint')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
