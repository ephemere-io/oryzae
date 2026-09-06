'use client';

import type { InlineImage } from '@oryzae/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyInlineImageStyle,
  isInlineImage,
  readInlineImageFromElement,
} from '@/features/pc/entries/utils/inline-image-codec';
import {
  type ResizeHandle,
  resizeInlineImage,
} from '@/features/pc/entries/utils/inline-image-resize';

/**
 * 本文中の写真の選択とリサイズを扱う。
 *
 * DOM を直接触るのは、本文が contentEditable だから。写真を React で描くと、
 * ブラウザが編集で書き換えた DOM と React の仮想 DOM が食い違って本文が壊れる。
 * ここでは「選ばれている `<img>` の実体」だけを state に持ち、見た目の更新は
 * その要素の style を書き換えて行う。
 */
interface UseInlineImageSelectionParams {
  editorRef: React.RefObject<HTMLElement | null>;
  /** 縦書きか。リサイズの軸の向きが変わる。 */
  isVertical: boolean;
  /** 写真の見た目が確定したとき（ドラッグ終了・レイアウト変更）に呼ぶ。 */
  onCommit: () => void;
}

interface InlineImageSelection {
  /** 選ばれている写真の要素。null なら未選択。 */
  element: HTMLImageElement | null;
  /** 選ばれている写真の現在の設定。 */
  image: InlineImage | null;
  /** 画面上の位置（オーバーレイを重ねるのに使う）。 */
  rect: DOMRect | null;
}

export function useInlineImageSelection({
  editorRef,
  isVertical,
  onCommit,
}: UseInlineImageSelectionParams) {
  const [selection, setSelection] = useState<InlineImageSelection>({
    element: null,
    image: null,
    rect: null,
  });

  // ドラッグ中の情報。再描画に関係しないので ref に置く。
  const dragRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    start: InlineImage;
    startInlinePx: number;
    startBlockPx: number;
  } | null>(null);

  /** 選択中の写真の位置をもう一度測る。ドラッグ中やスクロール後に呼ぶ。 */
  const refresh = useCallback(() => {
    setSelection((s) =>
      s.element
        ? {
            ...s,
            image: readInlineImageFromElement(s.element),
            rect: s.element.getBoundingClientRect(),
          }
        : s,
    );
  }, []);

  const clear = useCallback(() => {
    setSelection({ element: null, image: null, rect: null });
  }, []);

  const select = useCallback((el: HTMLImageElement) => {
    setSelection({
      element: el,
      image: readInlineImageFromElement(el),
      rect: el.getBoundingClientRect(),
    });
  }, []);

  // 写真をクリックしたら選ぶ。本文の他の場所を触ったら外す。
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      // EventTarget は Node とは限らない（window 等も来る）。絞ってから判定する。
      if (target instanceof Node && isInlineImage(target)) {
        select(target);
        return;
      }
      clear();
    };

    editor.addEventListener('pointerdown', onPointerDown);
    return () => editor.removeEventListener('pointerdown', onPointerDown);
  }, [editorRef, select, clear]);

  // 選択中に本文がスクロール/リサイズしたら、オーバーレイの位置を追従させる。
  useEffect(() => {
    if (!selection.element) return;
    const editor = editorRef.current;
    window.addEventListener('resize', refresh);
    editor?.addEventListener('scroll', refresh);
    return () => {
      window.removeEventListener('resize', refresh);
      editor?.removeEventListener('scroll', refresh);
    };
  }, [selection.element, editorRef, refresh]);

  /** ハンドルを掴んだ。ここから pointermove で追う。 */
  const beginResize = useCallback(
    (handle: ResizeHandle, e: React.PointerEvent) => {
      const el = selection.element;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        start: readInlineImageFromElement(el),
        // 画面の縦横ではなく、本文の inline / block 軸に直して持つ。
        startInlinePx: isVertical ? rect.height : rect.width,
        startBlockPx: isVertical ? rect.width : rect.height,
      };
      e.preventDefault();
      e.stopPropagation();
    },
    [selection.element, isVertical],
  );

  useEffect(() => {
    if (!selection.element) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const el = selection.element;
      const editor = editorRef.current;
      if (!drag || !el || !editor) return;

      const next = resizeInlineImage({
        start: drag.start,
        handle: drag.handle,
        dx: e.clientX - drag.startX,
        dy: e.clientY - drag.startY,
        // 1 行の長さ。縦書きなら editor の高さ。
        editorInlineSize: isVertical ? editor.clientHeight : editor.clientWidth,
        startInlinePx: drag.startInlinePx,
        startBlockPx: drag.startBlockPx,
        isVertical,
      });
      applyInlineImageStyle(el, { ...drag.start, ...next });
      refresh();
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      onCommit(); // 保存はドラッグ終了の 1 回だけ。移動中に毎回保存すると保存が詰まる。
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [selection.element, editorRef, isVertical, refresh, onCommit]);

  /** レイアウト（行内 / ブロック / 回り込み）と寄せを変える。 */
  const updateLayout = useCallback(
    (patch: Partial<Pick<InlineImage, 'layout' | 'align'>>) => {
      const el = selection.element;
      if (!el) return;
      applyInlineImageStyle(el, { ...readInlineImageFromElement(el), ...patch });
      refresh();
      onCommit();
    },
    [selection.element, refresh, onCommit],
  );

  /** 選択中の写真を本文から取り除く。 */
  const removeSelected = useCallback(() => {
    const el = selection.element;
    if (!el) return;
    el.remove();
    clear();
    onCommit();
  }, [selection.element, clear, onCommit]);

  return { selection, beginResize, updateLayout, removeSelected, clear };
}
