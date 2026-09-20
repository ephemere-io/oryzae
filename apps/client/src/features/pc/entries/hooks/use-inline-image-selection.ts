'use client';

import type { InlineImage } from '@oryzae/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { caretRangeFromPoint } from '@/features/pc/entries/utils/caret-from-point';
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
 * 本文中の写真の選択・移動・リサイズを扱う。
 *
 * DOM を直接触るのは、本文が contentEditable だから。写真を React で描くと、
 * ブラウザが編集で書き換えた DOM と React の仮想 DOM が食い違って本文が壊れる。
 * ここでは「選ばれている `<img>` の実体」だけを state に持ち、見た目の更新は
 * その要素の style を書き換えて行う。
 */
interface UseInlineImageSelectionParams {
  editorRef: React.RefObject<HTMLElement | null>;
  /** 縦書きか。「行に対する割合」が高さのことになる。 */
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

/** 掴んだと見なす距離（px）。これ未満は「選ぶためのクリック」として扱う。 */
const DRAG_THRESHOLD_PX = 6;

/**
 * 1 行の長さ（px）。**枠ではなく中身の箱**を測る。
 *
 * `clientWidth` は余白（padding）を含む。横書きの本文は左右に余白を持つので、それを
 * 行の長さだと思って割合を出すと、指した量より小さくしか伸びない（実測で、右の辺を
 * 80px 引いて 45px しか伸びず、そのぶん高さが 15px 縮んだ）。`inline-size: 40%` が
 * 割合を解決する相手は中身の箱なので、こちらもそれに合わせる。
 */
/**
 * 選択枠を置く位置。**本文の見えている範囲からはみ出したら null**（枠を出さない）。
 *
 * 枠は `position: fixed` で本文の外に描いている。本文は自分で
 * スクロールするので、写真だけが本文の枠外へ流れても、重ねた枠は画面に残る。
 * 実機レビューでは、写真を選んだままスクロールすると枠が宙に浮いて見えていた（#626）。
 * 写真そのものは本文の箱に切り取られるので、枠も同じところで切る。
 */
function visibleRect(el: HTMLElement, editor: HTMLElement | null): DOMRect | null {
  const rect = el.getBoundingClientRect();
  if (!editor) return rect;
  const box = editor.getBoundingClientRect();
  // レイアウトの無い環境（jsdom）では全部 0 になる。そこで隠すと何も検証できない。
  if (box.width === 0 && box.height === 0) return rect;
  const hidden =
    rect.bottom <= box.top ||
    rect.top >= box.bottom ||
    rect.right <= box.left ||
    rect.left >= box.right;
  return hidden ? null : rect;
}

function measureLineLength(editor: HTMLElement, isVertical: boolean): number {
  const style = getComputedStyle(editor);
  const padding = isVertical
    ? Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
    : Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const box = isVertical ? editor.clientHeight : editor.clientWidth;
  return Math.max(0, box - (Number.isFinite(padding) ? padding : 0));
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
  /** 掴んで運んでいる最中、いま落ちる先（文字の間）。運んでいなければ null。 */
  const [dropHint, setDropHint] = useState<DOMRect | null>(null);

  // ドラッグ中の情報。再描画に関係しないので ref に置く。
  const dragRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    start: InlineImage;
    startWidthPx: number;
    startHeightPx: number;
  } | null>(null);

  /** 写真そのものを掴んで、本文の別の場所へ移している最中。 */
  const moveRef = useRef<{
    el: HTMLImageElement;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  /** 選択中の写真の位置をもう一度測る。ドラッグ中やスクロール後に呼ぶ。 */
  const refresh = useCallback(() => {
    setSelection((s) =>
      s.element
        ? {
            ...s,
            image: readInlineImageFromElement(s.element),
            rect: visibleRect(s.element, editorRef.current),
          }
        : s,
    );
  }, [editorRef]);

  const clear = useCallback(() => {
    setSelection({ element: null, image: null, rect: null });
  }, []);

  const select = useCallback(
    (el: HTMLImageElement) => {
      setSelection({
        element: el,
        image: readInlineImageFromElement(el),
        rect: visibleRect(el, editorRef.current),
      });
    },
    [editorRef],
  );

  // 写真をクリックしたら選ぶ。本文の他の場所を触ったら外す。
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      // EventTarget は Node とは限らない（window 等も来る）。絞ってから判定する。
      if (target instanceof Node && isInlineImage(target)) {
        select(target);
        // ここから動かせば移動、動かさなければただの選択。どちらかは pointermove が決める。
        moveRef.current = {
          el: target,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          moved: false,
        };
        // **掴んだ写真にポインタを結びつける。** これが無いと、写真の外へ出た瞬間に
        // カーソルが文字選択の I ビームに変わり、運んでいる最中に見た目が崩れる。
        // （jsdom には無い API なので、在ることを確かめてから呼ぶ）
        try {
          target.setPointerCapture?.(e.pointerId);
        } catch {
          // 結びつけられない環境（レイアウトの無いテスト等）。運ぶこと自体はできる。
        }
        // 写真の上にキャレットを置かせない（Chrome は画像の中に入れようとする）。
        e.preventDefault();
        return;
      }
      clear();
    };

    editor.addEventListener('pointerdown', onPointerDown);
    return () => editor.removeEventListener('pointerdown', onPointerDown);
  }, [editorRef, select, clear]);

  // 選んでいる写真は Esc でも外せる。**押して外す道はパレットに置かない**
  // （道具が増えるほど、どれが本題か分からなくなる）。本文のどこかを押せば外れるが、
  // キーボードだけで辿っている人にはその道が無い。
  useEffect(() => {
    if (!selection.element) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection.element, clear]);

  // 選択中に画面がスクロール/リサイズしたら、オーバーレイの位置を追従させる。
  //
  // **捕捉フェーズで window に付ける。** scroll は上に伝わらないので、本文の要素にだけ
  // 付けていると、本文を包む箱のほうがスクロールしたときに何も起きない。実際、横書きでは
  // スクロールするのは本文ではなく外側の箱で、枠だけが画面に取り残されていた（#626）。
  // 捕捉フェーズなら、どの要素がスクロールしても window で拾える。
  useEffect(() => {
    if (!selection.element) return;
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [selection.element, refresh]);

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
        // 画面で見たままの寸法を渡す。軸の読み替えは resizeInlineImage の中だけで行う。
        startWidthPx: rect.width,
        startHeightPx: rect.height,
      };
      e.preventDefault();
      e.stopPropagation();
    },
    [selection.element],
  );

  /**
   * 指した場所の「文字の間」。本文の外や写真自身の中を指していれば null。
   *
   * 落ちる先の線を出すのにも、実際に落とすのにも同じものを使う。**見えている線と
   * 落ちる場所を別々に計算すると、見た目と結果がずれる。**
   */
  const dropTargetAt = useCallback(
    (el: HTMLImageElement, x: number, y: number): Range | null => {
      const editor = editorRef.current;
      if (!editor) return null;
      const range = caretRangeFromPoint(x, y);
      if (!range) return null;
      if (!editor.contains(range.startContainer)) return null;
      // 自分自身の中には落とせない（落とし先が消えることになる）。
      if (el.contains(range.startContainer)) return null;
      return range;
    },
    [editorRef],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // ① ハンドルを掴んでいる（大きさを変える）
      const drag = dragRef.current;
      const editor = editorRef.current;
      if (drag && selection.element && editor) {
        const next = resizeInlineImage({
          start: drag.start,
          handle: drag.handle,
          dx: e.clientX - drag.startX,
          dy: e.clientY - drag.startY,
          editorInlineSize: measureLineLength(editor, isVertical),
          startWidthPx: drag.startWidthPx,
          startHeightPx: drag.startHeightPx,
          isVertical,
        });
        applyInlineImageStyle(selection.element, { ...drag.start, ...next });
        refresh();
        return;
      }

      // ② 写真そのものを掴んでいる（位置を変える）
      const move = moveRef.current;
      if (!move) return;
      const far =
        Math.abs(e.clientX - move.startX) > DRAG_THRESHOLD_PX ||
        Math.abs(e.clientY - move.startY) > DRAG_THRESHOLD_PX;
      if (!far) return;
      if (!move.moved) {
        move.moved = true;
        // 掴んでいることを見た目で言う（薄くなる）。CSS は globals.css。
        move.el.dataset.dragging = 'true';
      }
      // いま離したらどこへ入るかを見せる。
      const target = dropTargetAt(move.el, e.clientX, e.clientY);
      // 実寸を測れない環境（レイアウトの無いテスト）では線を出さない。
      setDropHint(
        target && typeof target.getBoundingClientRect === 'function'
          ? target.getBoundingClientRect()
          : null,
      );
    };

    const onUp = (e: PointerEvent) => {
      if (dragRef.current) {
        dragRef.current = null;
        onCommit(); // 保存はドラッグ終了の 1 回だけ。移動中に毎回保存すると保存が詰まる。
        return;
      }
      const move = moveRef.current;
      moveRef.current = null;
      if (!move) return;
      move.el.removeAttribute('data-dragging');
      setDropHint(null);
      try {
        if (move.el.hasPointerCapture?.(move.pointerId)) {
          move.el.releasePointerCapture(move.pointerId);
        }
      } catch {
        // 結びつけていなければ外すものも無い。
      }
      if (!move.moved) return; // 動かしていない＝ただ選んだだけ
      const target = dropTargetAt(move.el, e.clientX, e.clientY);
      if (target) target.insertNode(move.el);
      // **入れ直したら測り直す。** これが無いと、枠だけが元の位置に取り残される。
      refresh();
      onCommit();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [selection.element, editorRef, isVertical, refresh, onCommit, dropTargetAt]);

  /** レイアウト（ブロック / 回り込み）・寄せ・幅を変える。 */
  const updateLayout = useCallback(
    (patch: Partial<Pick<InlineImage, 'layout' | 'align' | 'widthRatio'>>) => {
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

  return { selection, dropHint, beginResize, updateLayout, removeSelected, clear, refresh };
}
