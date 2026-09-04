'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import type { BoardCardData } from '@/features/shared/board/types';
import { useEntries } from '@/features/shared/entries/hooks/use-entries';
import { useEntryMonthlyCounts } from '@/features/shared/entries/hooks/use-entry-monthly-counts';
import { useFermentationInbox } from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
import { useFermentationKeywords } from '@/features/shared/fermentation/hooks/use-fermentation-keywords';
import { useFermentationReadiness } from '@/features/shared/fermentation/hooks/use-fermentation-readiness';
import type { ApiClient } from '@/lib/api';
import { readStaleCache, writeStaleCache } from '@/lib/stale-cache';
import { useUnread } from '@/lib/unread-context';
import { snippetLineCount } from '../scene/board';
import { MAX_WORDS } from '../scene/jar';
import type { StudyBoardCard, StudyEntry, StudyFermentationStatus, StudyState } from '../types';

/**
 * 書斎が読む状態を、既存の hook を束ねて作る。
 *
 * **書斎は横断的なビューであり、これ自体がドメインではない。** そのため他ドメインの
 * shared hook を素直に呼ぶ。fetch は各ドメインの `features/shared/{domain}/hooks` が
 * 持ったままで、ここは組み立てだけを行う。
 *
 * 未読件数は `useUnread()`（context）から取る。`(protected)/layout.tsx` が 1 回だけ
 * 取得したものを配っているので、ここで取り直さない（#363 の N+1 解消を維持）。
 */
/** 憶えてある書斎の形が変わったら上げる。 */
const CACHE_VERSION = 1;

/** 一週間。裏で必ず取り直すので、長くても古い値が居座らない。 */
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 憶えてある値の形を確かめる。
 *
 * 前のバージョンの自分が書いたものが入っているので、信用してそのまま 3D へ流すと、
 * 形が変わった瞬間にシーンの組み立てで落ちる。描く前にここで止める。
 */
function isCachedStudyState(value: unknown): value is StudyState {
  if (typeof value !== 'object' || value === null) return false;
  const state: Record<string, unknown> = { ...value };
  if (typeof state.now !== 'string') return false;
  if (typeof state.unreadCount !== 'number') return false;
  if (!Array.isArray(state.words)) return false;
  if (!Array.isArray(state.notebooks)) return false;
  if (!Array.isArray(state.entries)) return false;
  const fermentation = state.fermentation;
  if (typeof fermentation !== 'object' || fermentation === null) return false;
  const board = state.board;
  if (typeof board !== 'object' || board === null) return false;
  const boardRecord: Record<string, unknown> = { ...board };
  return Array.isArray(boardRecord.cards);
}

export function useStudyState(
  api: ApiClient | null,
  authLoading: boolean,
  /**
   * 憶えた内容を分けるための利用者。**null なら憶えない。**
   *
   * 認証 context をここで読まないのは、この hook を単体で試せるようにしておくため
   * （読むと AuthProvider の中でしか動かなくなる）。持っている側から渡す。
   */
  userId: string | null = null,
): {
  state: StudyState;
  loading: boolean;
} {
  const unread = useUnread();
  const { readiness, loading: readinessLoading } = useFermentationReadiness(api, authLoading);
  const { letters, loading: lettersLoading } = useFermentationInbox(api, authLoading);
  const { counts, loading: countsLoading } = useEntryMonthlyCounts(api, authLoading);
  const { entries, loading: entriesLoading } = useEntries(api);

  const now = useMemo(() => localDateKey(new Date()), []);
  const { cards, loading: boardLoading } = useBoard(api, now);

  // 瓶に漂う言葉は**問いごとの最新のキーワード**。いま漬けているものではない
  // （キーワードは発酵完了時に一括保存されるので、発酵中には 1 件も存在しない。
  // docs/oryzae-study/60-implementation-notes.md §3）。
  // 受信箱が問いごとに最新 1 通へ畳んでいるので、その全部から集める。
  const fermentationIds = useMemo(() => letters.map((letter) => letter.fermentationId), [letters]);
  const { keywords } = useFermentationKeywords(api, fermentationIds);

  // 憶えてある書斎。**利用者ごとに分ける** — 端末を共有していると、前の人の
  // 記録の冒頭や発酵の言葉がそのまま出てしまう。
  const cacheKey = userId === null ? null : `study:${userId}`;
  const [cached, setCached] = useState<StudyState | null>(null);
  const readCacheFor = useRef<string | null>(null);

  useEffect(() => {
    if (cacheKey === null || readCacheFor.current === cacheKey) return;
    readCacheFor.current = cacheKey;
    setCached(
      readStaleCache(
        cacheKey,
        { version: CACHE_VERSION, maxAgeMs: CACHE_MAX_AGE_MS },
        isCachedStudyState,
      ),
    );
  }, [cacheKey]);

  const live = useMemo<StudyState>(() => {
    const status = deriveStatus(readiness.readiness, letters.length);
    return {
      now,
      unreadCount: unread.unreadCount,
      fermentation: { readiness: readiness.readiness, status, letters },
      words: keywords.slice(0, MAX_WORDS),
      notebooks: counts.map((count) => ({
        month: count.month,
        entryCount: count.count,
        // 当月かどうかは月から決める（サーバーは「今日」を知らない）。
        current: count.month === now.slice(0, 7),
      })),
      entries: entries.map(toStudyEntry),
      board: { dateKey: now, viewType: 'daily', cards: cards.map(toStudyBoardCard) },
    };
  }, [now, unread.unreadCount, readiness.readiness, letters, keywords, counts, entries, cards]);

  const loading =
    readinessLoading || lettersLoading || countsLoading || entriesLoading || boardLoading;

  // 取り終えたら憶える。次に書斎を開いたとき、取得を待たずに前回の絵が出る。
  useEffect(() => {
    if (loading || cacheKey === null) return;
    writeStaleCache(cacheKey, live, { version: CACHE_VERSION, maxAgeMs: CACHE_MAX_AGE_MS });
  }, [loading, cacheKey, live]);

  /**
   * 取得が終わるまでは**前回の書斎**を出す。
   *
   * これが無いと、開くたびに空の机と空の壁がいったん出てから中身が入る。瓶の言葉と
   * ボードのカードは取得に時間がかかるので、その間ずっと空に見えていた。
   *
   * 日付だけは憶えた値を使わない。日をまたぐと当月の手帳が前月として出てしまう。
   */
  const state = useMemo<StudyState>(() => {
    if (!loading || cached === null) return live;
    return { ...cached, now: live.now, unreadCount: live.unreadCount };
  }, [loading, cached, live]);

  return {
    state,
    // 書斎は部分的な失敗で落とさない。全部そろうまで待つのではなく、
    // 骨格（瓶と手帳）が決まった時点で出す。
    loading,
  };
}

/**
 * 瓶の見た目の状態を合成する。
 *
 * サーバーの `FermentationStatus`（pending / processing / completed / failed）は
 * **発酵 1 件ごとの状態**で、利用者から見た瓶の様子とは別物。とくに「完了」は
 * 「まだ読んでいない手紙がある」という意味であり、その判定は localStorage にしか
 * 無いのでサーバーでは決められない（60-implementation-notes.md §1）。
 */
export function deriveStatus(readiness: number, letterCount: number): StudyFermentationStatus {
  if (letterCount > 0) return 'completed';
  if (readiness <= 0) return 'idle';
  return 'fermenting';
}

/** ローカル暦日の `YYYY-MM-DD`。`toISOString()` は UTC に寄るので使わない。 */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 本文の先頭 1 文（全角 60 字上限）。書斎の一覧は冒頭しか見せない。 */
export function toExcerpt(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length === 0) return '';
  // 句点・改行・ピリオドのうち最初に来たところで切る。
  const match = trimmed.match(/^[\s\S]*?(?:。|\n|\.\s)/);
  const firstSentence = (match ? match[0] : trimmed).trim();
  return firstSentence.length > 60 ? `${firstSentence.slice(0, 60)}…` : firstSentence;
}

function toStudyEntry(entry: {
  id: string;
  content: string;
  createdAt: string;
  linkedQuestions: { id: string; currentText: string | null }[];
}): StudyEntry {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    excerpt: toExcerpt(entry.content),
    // コードポイント単位。サロゲートペアを 2 と数えない。
    chars: [...entry.content].length,
    linkedQuestions: entry.linkedQuestions,
    // 問いにリンク済み＝漬けた。
    pickled: entry.linkedQuestions.length > 0,
  };
}

function toStudyBoardCard(card: BoardCardData): StudyBoardCard {
  return {
    id: card.id,
    cardType: card.cardType,
    x: card.x,
    y: card.y,
    rotation: card.rotation,
    width: card.width,
    height: card.height,
    zIndex: card.zIndex,
    // 本文そのものは書斎に出さない。長さだけを罫線の数に写す。
    lines:
      card.cardType === 'snippet' && 'text' in card.content
        ? snippetLineCount(card.content.text, card.height)
        : 1,
  };
}
