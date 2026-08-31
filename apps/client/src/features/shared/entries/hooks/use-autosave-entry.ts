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
   * **新規エントリを作るのに**必要な、保存する内容（タイトル + 本文）の最小文字数。
   * 既存エントリの更新には適用しない。打ち間違いの1文字でエントリが出来てしまうのを
   * 防ぐためだけのしきい値なので小さく取る。
   * **離脱時の書き出しには適用しない**（下記 saveNow の force を参照）。
   */
  minCreateChars?: number;
}

const DEFAULT_DEBOUNCE_MS = 2000;
// 打ち間違いの1文字でエントリが生えないための最小限。**短い記録を弾く値にしてはいけない**
// （「今日は疲れた」で終える人がいる。Issue #510 はまさにそれが消える話だった）。
// 数えるのはタイトル + 本文（composeContent の結果）。
const DEFAULT_MIN_CREATE_CHARS = 2;

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
  // 進行中の保存そのもの。離脱時はこれを待ってから書き直す（下記 saveNow の force を参照）。
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
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

  /**
   * @param force 離脱時の書き出し。**しきい値を無視して書く**。
   *   画面を離れるときに「まだ短いから」と捨てるのは、書いたものを失うのと同じ。
   *   しきい値は「打ちかけでエントリを作らない」ためのもので、離脱時には意味を持たない。
   */
  const saveNow = useCallback(async (force = false) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!latestRef.current.enabled) return;

    if (inFlightRef.current) {
      // 通常の保存なら、いま走っている保存が終わったあとに追いかけ保存が走るので降りてよい。
      if (!force) return;
      // 離脱時は降りられない。**降りると、保存中に打った分がそのまま消える**
      // （追いかけ保存は 2 秒の debounce に載るが、そのタイマーは離脱後には発火しない）。
      // 進行中の保存を待ってから、あらためて最新の内容を書く。
      await inFlightPromiseRef.current;
    }

    const current = latestRef.current;
    if (!current.enabled) return;

    // 判定はタイトルを含めた content で行う。本文だけを見ると、
    // 「題だけ付けて本文はこれから」の状態が丸ごと保存対象から外れる。
    const content = composeContent(current.title, current.body);
    if (!content.trim()) return;
    if (content === lastSavedContentRef.current) return;
    // まだエントリが存在しないときだけ、作成に足る長さを要求する（離脱時は要求しない）。
    if (!force && !current.entryId && content.trim().length < current.minCreateChars) return;

    inFlightRef.current = true;
    const run = (async () => {
      try {
        const savedId = await saveRef.current(content, current.entryId);
        if (savedId) {
          lastSavedContentRef.current = content;
          prevEntryIdRef.current = savedId;
          onSavedRef.current?.(savedId, current.body, current.title.trim());
        }
      } finally {
        inFlightRef.current = false;
        inFlightPromiseRef.current = null;
      }
    })();
    inFlightPromiseRef.current = run;
    await run;

    // 保存している間に書き進めていたら、その分をもう一度追いかける
    // （そうしないと「保存中に打った最後の数文字」が次の入力まで残らない）。
    const after = composeContent(latestRef.current.title, latestRef.current.body);
    if (after === lastSavedContentRef.current) return;
    // 離脱時は debounce に載せられない（タイマーが発火する前にページが消える）ので、
    // その場で続けて書く。
    if (force) return saveNow(true);
    scheduleRef.current();
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
    const content = composeContent(title, body);
    if (!content.trim()) return;
    if (content === lastSavedContentRef.current) return;
    if (!entryId && content.trim().length < minCreateChars) return;

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
      // 離脱時はしきい値を無視する。短くても書いたものは残す。
      void saveNow(true);
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
