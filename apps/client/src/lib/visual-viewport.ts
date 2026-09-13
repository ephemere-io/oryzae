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

function read(): VisualViewportBox {
  const viewport = window.visualViewport;
  if (!viewport) {
    return { top: 0, height: window.innerHeight, keyboardOpen: false };
  }
  const height = Math.round(viewport.height);
  return {
    top: Math.round(viewport.offsetTop),
    height,
    keyboardOpen: window.innerHeight - height >= KEYBOARD_MIN_HEIGHT,
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
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return box;
}
