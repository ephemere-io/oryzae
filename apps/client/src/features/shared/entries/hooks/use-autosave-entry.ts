'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseAutosaveEntryParams {
  title: string;
  body: string;
  entryId: string | undefined;
  save: (content: string, entryId?: string) => Promise<string | null>;
  /** 保存が成功したとき。savedTitle は trim 済み（保存された形）。 */
  onSaved?: (entryId: string, savedBody: string, savedTitle: string) => void;
  enabled: boolean;
  debounceMs?: number;
  /**
   * **新規エントリを作るのに**必要な最小文字数。既存エントリの更新には適用しない。
   * 打ち間違いの1文字でエントリが出来てしまうのを防ぐためだけのしきい値。
   */
  minCreateChars?: number;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_MIN_CREATE_CHARS = 10;

/** エディタの保存形式（先頭行＝タイトル）。 */
function composeContent(title: string, body: string): string {
  return title.trim() ? `${title.trim()}\n${body}` : body;
}

/**
 * 書いている内容を自動保存する（端末非依存）。Issue #510。
 *
 * SP には保存ボタンが無く、PC でも保存ボタンを廃した（docs/entry-screen-design.md 原則2）
 * ので、**書いたものが必ず残ること**はこの hook だけが保証する。
 *
 * 旧実装は「本文の**文字数**が最後の保存から 10 文字以上動いたか」で判定していて、
 * 次の3つがそのまま「書いたのに残っていない」になっていた:
 *
 *  - **短い記録が一度も保存されない** — 「今日は疲れた」で終える人は 10 文字に届かない
 *  - **書き換えが保存されない** — 10 文字消して 10 文字書くと差は 0。中身は変わっているのに素通り
 *  - **タイトルだけの変更が保存されない** — 判定が本文しか見ていなかった
 *
 * さらに離脱時の取りこぼしがあった。debounce 中に画面を離れる／アプリを背景に回すと、
 * 最後の入力が保存されないまま消える（モバイルでは日常的に起きる）。
 *
 * 直し方は「長さの差」をやめて**保存済みの content そのもの**と比べること。タイトルも含める。
 * タブが隠れたとき・ページを離れるとき・アンマウント時には保留分を書き出す。
 * 保存の頻度は debounce（既定 2 秒）が抑える。
 *
 * しきい値は「新規作成」にだけ残す（`minCreateChars`）。更新は差分があれば必ず保存する。
 */
export function useAutosaveEntry({
  title,
  body,
  entryId,
  save,
  onSaved,
  enabled,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minCreateChars = DEFAULT_MIN_CREATE_CHARS,
}: UseAutosaveEntryParams) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 保存中に次の保存が重ならないようにする（同じ内容を 2 回書かない）。
  const inFlightRef = useRef(false);
  const lastSavedContentRef = useRef<string | null>(null);
  const prevEntryIdRef = useRef<string | undefined>(entryId);

  // 最新の入力をコールバックから読むための箱（依存配列を空に保ち、リスナを貼り直さない）。
  const latestRef = useRef({ title, body, entryId, enabled, minCreateChars, debounceMs });
  latestRef.current = { title, body, entryId, enabled, minCreateChars, debounceMs };
  const saveRef = useRef(save);
  saveRef.current = save;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // 開いた直後の内容は「保存済み」とみなす（開いただけで PUT しない）。
  if (lastSavedContentRef.current === null) {
    lastSavedContentRef.current = composeContent(title, body);
  }
  // 別のエントリに切り替わったら基準を貼り直す（前のエントリの本文を新しい id に書かない）。
  // 自分の保存で id が確定した場合は saveNow 側で prevEntryIdRef を更新済みなので、ここは通らない。
  if (prevEntryIdRef.current !== entryId) {
    prevEntryIdRef.current = entryId;
    lastSavedContentRef.current = composeContent(title, body);
  }

  const scheduleRef = useRef<() => void>(() => {});

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = latestRef.current;
    if (!current.enabled || inFlightRef.current) return;
    if (!current.body.trim()) return;

    const content = composeContent(current.title, current.body);
    if (content === lastSavedContentRef.current) return;
    // まだエントリが存在しないときだけ、作成に足る長さを要求する。
    if (!current.entryId && current.body.trim().length < current.minCreateChars) return;

    inFlightRef.current = true;
    try {
      const savedId = await saveRef.current(content, current.entryId);
      if (savedId) {
        lastSavedContentRef.current = content;
        prevEntryIdRef.current = savedId;
        onSavedRef.current?.(savedId, current.body, current.title.trim());
      }
    } finally {
      inFlightRef.current = false;
    }

    // 保存している間に書き進めていたら、その分をもう一度追いかける
    // （そうしないと「保存中に打った最後の数文字」が次の入力まで残らない）。
    const after = composeContent(latestRef.current.title, latestRef.current.body);
    if (after !== lastSavedContentRef.current) scheduleRef.current();
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void saveNow();
    }, latestRef.current.debounceMs);
  }, [saveNow]);
  scheduleRef.current = schedule;

  useEffect(() => {
    if (!enabled) return;
    if (!body.trim()) return;
    const content = composeContent(title, body);
    if (content === lastSavedContentRef.current) return;
    if (!entryId && body.trim().length < minCreateChars) return;

    schedule();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [title, body, entryId, enabled, minCreateChars, schedule]);

  // デバウンス待ちのまま離脱すると書いたものが消える。タブが隠れたとき（SP のホーム戻り・
  // アプリ切り替え）とアンマウント時に、保留分を保存しにいく。
  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    function flush() {
      void saveNow();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flush();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [enabled, saveNow]);
}
