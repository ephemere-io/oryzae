'use client';

import { useEffect } from 'react';

interface UseTypewriterScrollOptions {
  /** contentEditable 本体。キャレットがこの中にあるときだけ働く。 */
  editorRef: React.RefObject<HTMLElement | null>;
  /** 横書きでスクロールする外枠（縦書きでは editor 自身がスクローラ）。 */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  writingMode: 'vertical' | 'horizontal';
  enabled: boolean;
}

/** キャレットをこの位置（スクローラに対する比率）より先に進ませない。 */
const CARET_ANCHOR = 0.5;

/**
 * 書き続けてもキャレットが画面の中央付近に留まるようにする（Issue #364）。
 *
 * 「縦書きだと左端に行くと半透明になってスクロールしなくちゃいけない／横書きでもスクロールが
 * 必要」＝ 書いている手が止まる、という指摘への対応。紙のほうを動かし、書き手は動かさない。
 * docs/entry-screen-design.md §3「本文（紙）」。
 *
 * - **入力時だけ**動かす。selectionchange やスクロールでは動かさないので、読み返しのために
 *   自分でスクロールした位置を奪わない。
 * - 内容がスクローラに収まっている間は何もしない（短い文章で画面が動かない）。
 * - Range/レイアウト API が使えない環境（SSR・jsdom）では黙って no-op になる。
 */
export function useTypewriterScroll({
  editorRef,
  scrollContainerRef,
  writingMode,
  enabled,
}: UseTypewriterScrollOptions): void {
  useEffect(() => {
    if (!enabled) return;
    const editor = editorRef.current;
    if (!editor || typeof window === 'undefined') return;

    function keepCaretAnchored() {
      const el = editorRef.current;
      if (!el) return;
      // 縦書きは editor 自身が overflowX:auto のスクローラ、横書きは外枠が overflow:auto。
      const scroller = writingMode === 'vertical' ? el : scrollContainerRef.current;
      if (!scroller) return;

      const caret = readCaretRect(el);
      if (!caret) return;
      const box = scroller.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;

      if (writingMode === 'vertical') {
        // vertical-rl: 行は右から左へ伸びる。scrollLeft は先頭(右端)で 0、左へ進むと負。
        if (scroller.scrollWidth - scroller.clientWidth < 1) return;
        const anchor = box.left + box.width * CARET_ANCHOR;
        const delta = caret.left - anchor;
        if (delta < 0) scroller.scrollLeft += delta;
      } else {
        if (scroller.scrollHeight - scroller.clientHeight < 1) return;
        const anchor = box.top + box.height * CARET_ANCHOR;
        const delta = caret.bottom - anchor;
        if (delta > 0) scroller.scrollTop += delta;
      }
    }

    // 入力の直後はまだ再レイアウト前のことがあるので、次フレームで測る。
    function handleInput() {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(keepCaretAnchored);
      } else {
        keepCaretAnchored();
      }
    }

    editor.addEventListener('input', handleInput);
    return () => editor.removeEventListener('input', handleInput);
  }, [editorRef, scrollContainerRef, writingMode, enabled]);
}

/** キャレット位置の矩形。取得できない/測れない環境では null。 */
function readCaretRect(editor: HTMLElement): DOMRect | null {
  const selection = window.getSelection?.();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return null;

  const rects = range.getClientRects();
  const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();
  if (!rect) return null;
  // jsdom などレイアウトを持たない環境では全て 0 が返る。動かす根拠が無いので何もしない。
  if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) return null;
  return rect;
}
