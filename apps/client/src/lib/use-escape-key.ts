'use client';

import { useEffect } from 'react';

/**
 * Escape で閉じる、を window の **capture フェーズ**で拾う。
 *
 * overlay に `onKeyDown` を付けるだけでは閉じない。フォーカスは中身（textarea 等）に
 * あり、ボードのダイアログは form で `onKeyDown={(e) => e.stopPropagation()}` している。
 * ここが厄介で、React の SyntheticEvent.stopPropagation() は **ネイティブイベントの
 * stopPropagation も呼ぶ**。React のリスナーは root コンテナ（window より下）に
 * 付いているため、bubble フェーズで window に登録しても届かない。
 *
 * capture は target へ下りる前に window を通るので、この stopPropagation より先に
 * 拾える。実機で「bubble では届かない / capture では届く」ことを確認済み。
 *
 * IME 変換中（`isComposing`）は無視する。日本語入力では変換候補を取り消すための
 * Escape が先にあり、それでモーダルまで閉じると入力内容ごと消える。
 */
export function useEscapeKey(enabled: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) onEscape();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, onEscape]);
}
