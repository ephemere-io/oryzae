'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeSummaries } from '@/features/shared/fermentation/normalize';
import type { FermentationSummary } from '@/features/shared/fermentation/types';
import type { ApiClient } from '@/lib/api';
import type { UnreadState } from '@/lib/unread-context';

/**
 * 旧実装の「瓶を最後に見た時刻」。これ以前に届いた手紙は既読とみなす下限として読み続ける
 * （既存ユーザーの既読状態を引き継ぐため）。書き込むのは markAllSeen だけ。
 */
const LAST_SEEN_KEY = 'oryzae_jar_last_seen_at';

/**
 * 問いごとの「ここまで読んだ」時刻。
 *
 * Issue #447: 既読判定が LAST_SEEN_KEY 1本だったため、瓶を開いた瞬間に届いていた手紙が
 * 全部既読になり、逆に開いた手紙は一覧上で未読のまま残っていた（時刻は開いた瞬間に更新
 * されるのに、一覧の未読は取得時点で確定していたため）。
 *
 * 手紙 id の集合ではなく「問い→時刻」で持つのは 2 つの理由から:
 *  - 受信箱は問いごとに最新1通しか出さない。id 集合だと同じ問いの古い手紙が
 *    「開けないのに未読」として永久に残る
 *  - 既読化が手元の発酵一覧に依存しない。一覧の取得より先にタップされても取りこぼさない
 * 新しい手紙は createdAt がこの時刻より後になるので、ちゃんと未読に戻る。
 */
const QUESTION_READ_AT_KEY = 'oryzae_question_read_at';

/** localStorage は private mode / 容量超過で throw しうる。既読は補助情報なので握る。 */
function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できなくても画面表示は壊れない（次回起動で未読に戻るだけ）。
  }
}

/** ISO 文字列を epoch ms に。壊れていれば null。 */
function toEpoch(iso: string): number | null {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : at;
}

/** 保存済みの「問い→ここまで読んだ時刻(epoch ms)」を読む。 */
function readQuestionReadAt(): Map<string, number> {
  const out = new Map<string, number>();
  const raw = safeGetItem(QUESTION_READ_AT_KEY);
  if (!raw) return out;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return out;
    for (const [questionId, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') continue;
      const at = toEpoch(value);
      if (at !== null) out.set(questionId, at);
    }
  } catch {
    // 壊れた値でも未読が余分に出るだけ。空で続行する。
  }
  return out;
}

function writeQuestionReadAt(map: Map<string, number>): void {
  const obj: Record<string, string> = {};
  for (const [questionId, at] of map) obj[questionId] = new Date(at).toISOString();
  safeSetItem(QUESTION_READ_AT_KEY, JSON.stringify(obj));
}

/** 「まとめて既読」の時刻（epoch ms）。未設定なら 0＝すべて未読候補。 */
function readLastSeenAt(): number {
  const raw = safeGetItem(LAST_SEEN_KEY);
  if (!raw) return 0;
  return toEpoch(raw) ?? 0;
}

/** 届いた手紙が未読か。「まとめて既読」とその問いの既読時刻、どちらより後なら未読。 */
function isUnread(
  letter: FermentationSummary,
  readAtByQuestion: Map<string, number>,
  lastSeenAt: number,
): boolean {
  const createdAt = toEpoch(letter.createdAt);
  // 日付が壊れている行は既読側に倒す（消えないバッジより、出ない方がまし）。
  if (createdAt === null) return false;
  if (createdAt <= lastSeenAt) return false;
  const readAt = readAtByQuestion.get(letter.questionId);
  return readAt === undefined || createdAt > readAt;
}

/**
 * ナビのバッジ・問い一覧の印・瓶の既読を賄う未読状態を作る（端末非依存）。
 * 値は UnreadProvider に渡して全画面へ配る。取得はここで 1 回だけ（#363 の N+1 解消を維持）。
 */
export function useUnreadLetters(api: ApiClient | null, authLoading: boolean): UnreadState {
  const [letters, setLetters] = useState<FermentationSummary[]>([]);
  const [ready, setReady] = useState(false);
  // localStorage は SSR で読めないので初期値は「既読なし」に倒し、マウント後に実値を入れる。
  // ready=false の間は印を出さない契約なので、この一瞬のズレは画面に出ない。
  const [readAtByQuestion, setReadAtByQuestion] = useState<Map<string, number>>(() => new Map());
  const [lastSeenAt, setLastSeenAt] = useState(0);

  // 既読は必ず単調に増やす。この hook は (protected)/layout に居るので、子孫（JarView の
  // markAllSeen 等）の effect が先に走る。無条件に代入すると直後に既読が巻き戻る。
  useEffect(() => {
    setReadAtByQuestion((prev) => {
      const merged = readQuestionReadAt();
      for (const [questionId, at] of prev) {
        merged.set(questionId, Math.max(at, merged.get(questionId) ?? 0));
      }
      return merged;
    });
    setLastSeenAt((prev) => Math.max(prev, readLastSeenAt()));
  }, []);

  useEffect(() => {
    if (!api || authLoading) return;
    const client = api;
    let cancelled = false;

    async function check() {
      try {
        // Issue #363 perf: 全発酵をバルク取得（questionId 省略）する。
        // 旧来は /questions → 問いごとに /fermentations の N+1 だった。
        const res = await client.fetch('/api/v1/fermentations');
        if (!res.ok || cancelled) return;
        const data: unknown = await res.json();
        if (cancelled) return;
        // normalizeSummaries が要素ごとに形を確かめる。配列でないレスポンス
        // （エラーエンベロープ等）で TypeError にならないのが要点。
        setLetters(normalizeSummaries(data).filter((s) => s.status === 'completed'));
        setReady(true);
      } catch {
        // バッジは補助表示。取れなければ 0 のままでよく、ナビ全体を巻き込まない
        // （catch が無いと useEffect 内の未処理 rejection になっていた）。
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [api, authLoading]);

  const unreadLetters = useMemo(
    () => letters.filter((l) => isUnread(l, readAtByQuestion, lastSeenAt)),
    [letters, readAtByQuestion, lastSeenAt],
  );

  const unreadQuestionIds = useMemo(
    () => new Set(unreadLetters.map((l) => l.questionId)),
    [unreadLetters],
  );

  const markQuestionRead = useCallback(
    (questionId: string) => {
      // 基準は「今」。ただしサーバ時刻のズレで createdAt が未来になっている手紙が手元に
      // 見えているならそこまで進める（開いたのに消えないバッジを作らない）。
      // letters が未取得でも「今」で確定するので、取得前にタップされても取りこぼさない。
      let readAt = Date.now();
      for (const letter of letters) {
        if (letter.questionId !== questionId) continue;
        const at = toEpoch(letter.createdAt);
        if (at !== null && at > readAt) readAt = at;
      }
      setReadAtByQuestion((prev) => {
        if ((prev.get(questionId) ?? 0) >= readAt) return prev;
        const next = new Map(prev).set(questionId, readAt);
        writeQuestionReadAt(next);
        return next;
      });
    },
    [letters],
  );

  const markAllSeen = useCallback(() => {
    const now = Date.now();
    safeSetItem(LAST_SEEN_KEY, new Date(now).toISOString());
    setLastSeenAt((prev) => Math.max(prev, now));
  }, []);

  return useMemo(
    () => ({
      ready,
      unreadCount: unreadLetters.length,
      unreadQuestionIds,
      markQuestionRead,
      markAllSeen,
    }),
    [ready, unreadLetters.length, unreadQuestionIds, markQuestionRead, markAllSeen],
  );
}
