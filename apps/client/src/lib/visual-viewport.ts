'use client';

import { useEffect, useState } from 'react';

/** いま実際に見えている範囲（ビジュアルビューポート）。レイアウトビューポートからの位置と高さ。 */
export interface VisualViewportBox {
  /** レイアウトビューポートの上端からの距離（px）。キーボードで押し上げられると正になる。 */
  top: number;
  height: number;
  /** ソフトキーボードが出ているとみなせるか。 */
  keyboardOpen: boolean;
}

/**
 * 「縮んだ高さ」がこれ以上ならキーボードとみなす（px）。
 *
 * ブラウザのツールバーの出入りは 50〜100px、キーボードは 250px 以上。
 */
const KEYBOARD_MIN_HEIGHT = 120;

/** ソフトキーボードを出しうる要素（文字を打つ所）にフォーカスがあるか。 */
function editingText(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable || active.getAttribute('contenteditable') !== null) return true;
  if (active instanceof HTMLTextAreaElement) return !active.readOnly;
  if (active instanceof HTMLInputElement) {
    return (
      !active.readOnly &&
      !['button', 'checkbox', 'radio', 'file', 'submit', 'range', 'color'].includes(active.type)
    );
  }
  return false;
}

function read(): VisualViewportBox {
  const viewport = window.visualViewport;
  if (!viewport) {
    return { top: 0, height: window.innerHeight, keyboardOpen: false };
  }
  const height = Math.round(viewport.height);
  const shrunkLikeKeyboard = window.innerHeight - height >= KEYBOARD_MIN_HEIGHT;
  const zoomed = Number.isFinite(viewport.scale) && viewport.scale !== 1;
  // キーボードほど縮んでいるのに、文字を打つ所にフォーカスが無い（ピンチで拡大もしていない）なら、
  // それはキーボードが閉じたあとの古い値。iOS は写真の選択などでキーボードを閉じたとき、ビジュアル
  // ビューポートの高さを戻さないまま残すことがあり、殻が縮んだまま写真の取り込みシートが画面の上の
  // ほうに浮いた（レビュー）。レイアウトビューポートいっぱいに戻す。
  if (shrunkLikeKeyboard && !zoomed && !editingText()) {
    return { top: 0, height: window.innerHeight, keyboardOpen: false };
  }
  return {
    top: Math.round(viewport.offsetTop),
    height,
    keyboardOpen: shrunkLikeKeyboard,
  };
}

/**
 * ビジュアルビューポートに追従する。
 *
 * iOS の Safari はキーボードが出ても `window.innerHeight`（レイアウトビューポート）を変えず、
 * `visualViewport` の高さだけを縮め、キャレットを見せるために `offsetTop` をずらす。
 * `position: fixed` はレイアウトビューポート基準なので、そのままでは下端の道具がキーボードの
 * 後ろに落ちたり、スクロールで本文の下に潜ったりする（実機で報告）。
 *
 * 画面の殻（`SpShell`）をこの値どおりの位置・高さに置けば、殻の下端が常にキーボードの上端になり、
 * 殻の中の道具は流れの中に置くだけでよくなる。`fixed` も `bottom: keyboard` も要らない。
 *
 * SSR と初回描画では `null`（測れるまで `100dvh` で描く）。
 */
export function useVisualViewport(): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      // 連続して来る resize / scroll を 1 フレームにまとめる。
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setBox(read()));
    };
    update();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    // フォーカスの出入り（キーボードの出入りのきっかけ）と、別の画面（写真の選択）から戻ったときにも読み直す。
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    window.addEventListener('focus', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      window.removeEventListener('focus', update);
    };
  }, []);

  return box;
}
