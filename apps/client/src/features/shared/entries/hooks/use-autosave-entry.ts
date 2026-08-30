'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseAutosaveEntryParams {
  title: string;
  body: string;
  entryId: string | undefined;
  save: (content: string, entryId?: string) => Promise<string | null>;
  onSaved?: (entryId: string, savedBody: string) => void;
  enabled: boolean;
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 2000;

/** エディタの保存形式: 先頭行がタイトル、残りが本文。 */
function composeContent(title: string, body: string): string {
  return title.trim() ? `${title.trim()}\n${body}` : body;
}

/**
 * 書いている内容を自動保存する（端末非依存）。
 *
 * Issue #510: 旧実装は「本文の**文字数**が最後の保存から 10 文字以上動いたか」で保存を
 * 判定していた。SP には保存ボタンが無く autosave が唯一の保存経路なので、次の 3 つが
 * そのまま「書いたのに残っていない」になっていた。
 *
 *  - **短い記録が一度も保存されない。** 「今日は疲れた」で終える人は 10 文字に届かず、
 *    そのまま離れると何も残らない
 *  - **書き換えが保存されない。** 10 文字消して 10 文字書くと差は 0。中身は変わっているのに
 *    保存対象にならない
 *  - **タイトルだけの変更が保存されない。** 判定は本文しか見ていなかった
 *
 * さらに、離脱時の取りこぼしがあった。debounce 中に画面を離れる／アプリを背景に回すと、
 * 最後の入力は保存されないまま消える（モバイルでは日常的に起きる）。
 *
 * 直し方: 判定を「保存済みの内容と一致するか」に変え（長さではなく値）、タイトルも含める。
 * アンマウント・バックグラウンド化のタイミングで保留分を必ず書き出す。
 * 保存の頻度は debounce（既定 2 秒）が抑える。
 */
export function useAutosaveEntry({
  title,
  body,
  entryId,
  save,
  onSaved,
  enabled,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseAutosaveEntryParams) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>(composeContent(title, body));
  const prevEntryIdRef = useRef<string | undefined>(entryId);
  // 保存中に次の保存が重ならないようにする（同じ内容を 2 回書かない）。
  const savingRef = useRef(false);
  // 離脱時のフラッシュから最新値を読むための箱。effect の再登録を増やさないため ref で持つ。
  const latestRef = useRef({ title, body, entryId, enabled, save, onSaved });
  latestRef.current = { title, body, entryId, enabled, save, onSaved };

  // autosave がエントリを作った直後など、id が変わったら基準を引き直す。
  if (prevEntryIdRef.current !== entryId) {
    prevEntryIdRef.current = entryId;
    lastSavedContentRef.current = composeContent(title, body);
  }

  const flush = useCallback(async () => {
    const current = latestRef.current;
    if (!current.enabled) return;
    if (savingRef.current) return;

    const content = composeContent(current.title, current.body);
    // 空（タイトルも本文も無い）は保存しない。まだ何も書いていない状態でエントリを作らない。
    if (!content.trim()) return;
    if (content === lastSavedContentRef.current) return;

    savingRef.current = true;
    try {
      const savedId = await current.save(content, current.entryId);
      if (savedId) {
        lastSavedContentRef.current = content;
        current.onSaved?.(savedId, current.body);
      }
    } finally {
      savingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const content = composeContent(title, body);
    if (!content.trim()) return;
    if (content === lastSavedContentRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [body, title, enabled, debounceMs, flush]);

  // 離脱時の取りこぼしを塞ぐ。visibilitychange はタブ切替・ホームに戻る操作で、
  // pagehide は iOS Safari で unload が発火しない経路のために両方を見る。
  useEffect(() => {
    if (typeof document === 'undefined') return;

    function flushIfHidden() {
      if (document.visibilityState === 'hidden') flush();
    }

    document.addEventListener('visibilitychange', flushIfHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flushIfHidden);
      window.removeEventListener('pagehide', flush);
      // 画面を離れる（別ページへ遷移する）ときも、保留中の入力を書き出す。
      flush();
    };
  }, [flush]);
}
