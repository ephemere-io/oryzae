'use client';

import { createContext, useContext } from 'react';

/**
 * 未読状態の配布口（context の器のみ）。
 *
 * 算出（発酵の取得・既読の保存）は features/shared/fermentation/hooks/use-unread-letters が
 * 持ち、ここは値の形と配布だけ。lib は「ドメイン非依存の基盤」なので、型もプリミティブと
 * コールバックだけで構成し、発酵/問いのドメイン型は参照しない（auth/theme context と同じ扱い）。
 *
 * page ごとに hook を呼ぶ形にはしない。インスタンスが分かれると、瓶で既読にしても
 * ナビのバッジが減らなくなる（Issue #447 の再発）。
 */
export interface UnreadState {
  /** 手紙一覧を1回でも取得できたか。false の間は未読/既読の印を出さない（逆ちらつき防止）。 */
  ready: boolean;
  /** 未読の手紙（＝まだ開いていない完了発酵）の件数。ナビのバッジに出す。 */
  unreadCount: number;
  /** 未読の手紙が届いている問いの id（Issue #452: 問い一覧にも印を出す）。 */
  unreadQuestionIds: ReadonlySet<string>;
  /**
   * 未読の手紙（＝完了発酵）そのものの id。
   * 発酵履歴（Cover Flow）は 1 問いに複数の発酵を並べるので、問い単位では
   * どの回が新しいのかを言えない。円盤・日付レールの印はこちらを見る。
   */
  unreadFermentationIds: ReadonlySet<string>;
  /**
   * その問いに今届いている手紙を既読にする（Issue #447）。
   * 受信箱は問いごとに最新1通しか出さないので、既読の単位も問いに揃える。
   */
  markQuestionRead: (questionId: string) => void;
  /** 届いている手紙をすべて既読にする。PC の瓶は盤面に全部並ぶので開いた＝読んだ。 */
  markAllSeen: () => void;
}

/** provider 不在（孤立検証・テスト）でも crash させないための既定値。 */
const EMPTY: UnreadState = {
  ready: false,
  unreadCount: 0,
  unreadQuestionIds: new Set(),
  unreadFermentationIds: new Set(),
  markQuestionRead: () => {},
  markAllSeen: () => {},
};

const UnreadContext = createContext<UnreadState>(EMPTY);

export function useUnread(): UnreadState {
  return useContext(UnreadContext);
}

export function UnreadProvider({
  value,
  children,
}: {
  value: UnreadState;
  children: React.ReactNode;
}) {
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}
