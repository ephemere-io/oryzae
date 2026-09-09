'use client';

import type { InlineImage } from '@oryzae/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyInlineImageStyle,
  isInlineImage,
  readInlineImageFromElement,
} from '@/features/pc/entries/utils/inline-image-codec';
import {
  applyDrop,
  type DropTarget,
  findDropTarget,
} from '@/features/pc/entries/utils/inline-image-drop';
import {
  type ResizeHandle,
  resizeInlineImage,
} from '@/features/pc/entries/utils/inline-image-resize';

/**
 * 本文中の写真の選択・リサイズ・回転・移動を扱う。
 *
 * DOM を直接触るのは、本文が contentEditable だから。写真を React で描くと、
 * ブラウザが編集で書き換えた DOM と React の仮想 DOM が食い違って本文が壊れる。
 * ここでは「選ばれている `<img>` の実体」だけを state に持ち、見た目の更新は
 * その要素の style を書き換えて行う。
 */
interface UseInlineImageSelectionParams {
  editorRef: React.RefObject<HTMLElement | null>;
  /**
   * 本文を包むスクロール要素。**overlay はこの中に、この要素の座標系で描く。**
   *
   * 以前は viewport 座標（position: fixed）に描き、スクロールのたびに測り直していた。
   * だが実際にスクロールするのはこの要素であって本文の要素ではないため、
   * `editor` に付けた scroll リスナーは一度も発火せず、枠だけが取り残されていた
   * （scroll はバブルしないので、祖先で拾うこともできない）。
   *
   * スクロールする箱の中に、その箱の座標で描けば、追従は**構造的に**保証される。
   */
  scrollHostRef: React.RefObject<HTMLElement | null>;
  /** 縦書きか。リサイズの軸の向きが変わる。 */
  isVertical: boolean;
  /** 写真の見た目や位置が確定したとき（ドラッグ終了・回転終了・削除）に呼ぶ。 */
  onCommit: () => void;
}

interface InlineImageSelection {
  element: HTMLImageElement | null;
  image: InlineImage | null;
  rect: DOMRect | null;
}

/**
 * クリックと移動を分ける距離（px）。
 *
 * これが無いと、選ぼうとして少し指が動いただけで写真が動いてしまう。Word も
 * わずかに動かすまでは移動を始めない。
 */
const DRAG_THRESHOLD_PX = 4;

export function useInlineImageSelection({
  editorRef,
  scrollHostRef,
  isVertical,
  onCommit,
}: UseInlineImageSelectionParams) {
  const [selection, setSelection] = useState<InlineImageSelection>({
    element: null,
    image: null,
    rect: null,
  });
  /** ドラッグ中に「ここに入る」を示す線。null なら出さない。 */
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);

  const resizeRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    start: InlineImage;
    startInlinePx: number;
    startBlockPx: number;
  } | null>(null);

  const rotateRef = useRef<{
    start: InlineImage;
    centerX: number;
    centerY: number;
    startAngle: number;
  } | null>(null);

  /** 移動。しきい値を超えるまで `active` は false のまま（＝ただのクリック）。 */
  const moveRef = useRef<{
    el: HTMLImageElement;
    startX: number;
    startY: number;
    active: boolean;
    target: DropTarget | null;
  } | null>(null);

  /**
   * viewport 座標を、スクロール要素の内容座標に直す。
   * この座標で描けば、スクロールしても測り直さずに付いてくる。
   */
  const toHostCoords = useCallback(
    (rect: DOMRect): DOMRect => {
      const host = scrollHostRef.current;
      if (!host) return rect;
      const hostRect = host.getBoundingClientRect();
      return new DOMRect(
        rect.left - hostRect.left + host.scrollLeft,
        rect.top - hostRect.top + host.scrollTop,
        rect.width,
        rect.height,
      );
    },
    [scrollHostRef],
  );

  const refresh = useCallback(() => {
    setSelection((s) =>
      s.element
        ? {
            ...s,
            image: readInlineImageFromElement(s.element),
            rect: toHostCoords(s.element.getBoundingClientRect()),
          }
        : s,
    );
  }, [toHostCoords]);

  const clear = useCallback(() => {
    setSelection({ element: null, image: null, rect: null });
  }, []);

  const select = useCallback(
    (el: HTMLImageElement) => {
      setSelection({
        element: el,
        image: readInlineImageFromElement(el),
        rect: toHostCoords(el.getBoundingClientRect()),
      });
    },
    [toHostCoords],
  );

  /** 移動を打ち切って見た目を戻す。取り消しでも完了でも通る。 */
  const endMove = useCallback(() => {
    const move = moveRef.current;
    moveRef.current = null;
    setDropRect(null);
    document.body.style.removeProperty('cursor');
    if (move) move.el.style.opacity = '';
    return move;
  }, []);

  // 写真をクリックしたら選ぶ。本文の他の場所を触ったら外す。
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node) || !isInlineImage(target)) {
        clear();
        return;
      }
      select(target);
      // ここでは preventDefault しない。動かさずに放したときは、ただの選択として
      // 扱いたい（キャレット操作や二度目のクリックを潰さない）。
      moveRef.current = {
        el: target,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        target: null,
      };
    };

    editor.addEventListener('pointerdown', onPointerDown);
    return () => editor.removeEventListener('pointerdown', onPointerDown);
  }, [editorRef, select, clear]);

  /**
   * スクロールでは測り直さない（内容座標に描いてあるので付いてくる）。
   * 測り直すのは **写真の見た目や本文の折り返しが変わったとき** だけ。
   */
  useEffect(() => {
    const el = selection.element;
    if (!el) return;
    const observer = new ResizeObserver(refresh);
    observer.observe(el);
    const editor = editorRef.current;
    if (editor) observer.observe(editor); // 本文の折り返しが変われば位置も動く
    window.addEventListener('resize', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refresh);
    };
  }, [selection.element, editorRef, refresh]);

  const beginResize = useCallback(
    (handle: ResizeHandle, e: React.PointerEvent) => {
      const el = selection.element;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      resizeRef.current = {
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

  const beginRotate = useCallback(
    (e: React.PointerEvent) => {
      const el = selection.element;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      rotateRef.current = {
        start: readInlineImageFromElement(el),
        centerX,
        centerY,
        startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
      };
      e.preventDefault();
      e.stopPropagation();
    },
    [selection.element],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const editor = editorRef.current;
      if (!editor) return;

      // ── 移動 ───────────────────────────────────────
      const move = moveRef.current;
      if (move) {
        if (!move.active) {
          const far =
            Math.abs(e.clientX - move.startX) > DRAG_THRESHOLD_PX ||
            Math.abs(e.clientY - move.startY) > DRAG_THRESHOLD_PX;
          if (!far) return; // まだクリックの範囲。移動を始めない。
          move.active = true;
          move.el.style.opacity = '0.4'; // 運んでいるものを分かるようにする
          document.body.style.setProperty('cursor', 'grabbing');
        }
        // 落ちる先を毎回測って線で示す。Word の挿入バーと同じ役割。
        move.target = findDropTarget(editor, move.el, e.clientX, e.clientY);
        setDropRect(move.target ? toHostCoords(move.target.rect) : null);
        e.preventDefault(); // ドラッグ中にテキスト選択が走らないように
        return;
      }

      // ── 回転 ───────────────────────────────────────
      const el = selection.element;
      if (!el) return;
      const rotate = rotateRef.current;
      if (rotate) {
        const angle = Math.atan2(e.clientY - rotate.centerY, e.clientX - rotate.centerX);
        const deltaDeg = ((angle - rotate.startAngle) * 180) / Math.PI;
        applyInlineImageStyle(el, {
          ...rotate.start,
          rotation: Math.round((rotate.start.rotation ?? 0) + deltaDeg),
        });
        refresh();
        return;
      }

      // ── リサイズ ───────────────────────────────────
      const drag = resizeRef.current;
      if (!drag) return;
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
      if (moveRef.current) {
        const finished = endMove();
        // 動かさずに放しただけなら、位置は変えない（＝ただの選択）。
        if (finished?.active && finished.target && applyDrop(finished.el, finished.target)) {
          refresh();
          onCommit();
        }
        return;
      }

      if (!resizeRef.current && !rotateRef.current) return;
      resizeRef.current = null;
      rotateRef.current = null;
      onCommit(); // 保存はドラッグ終了の 1 回だけ。移動中に毎回保存すると保存が詰まる。
    };

    /** Esc で移動を取り消す。運んでいる途中で戻せないと、置き場所を試せない。 */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !moveRef.current) return;
      endMove();
      e.preventDefault();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selection.element, editorRef, isVertical, refresh, onCommit, endMove, toHostCoords]);

  /** 選択中の写真を本文から取り除く。 */
  const removeSelected = useCallback(() => {
    const el = selection.element;
    if (!el) return;
    el.remove();
    clear();
    onCommit();
  }, [selection.element, clear, onCommit]);

  return { selection, dropRect, beginResize, beginRotate, removeSelected, clear };
}
