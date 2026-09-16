'use client';

import { createContext, useCallback, useContext } from 'react';
import { markStudyArrivalFor } from '@/features/shared/study/arrival';
import type { EntranceControls } from '../types';
import { staysAtEntrance } from './passage';

/**
 * 扉が無いときの操作。**待たせずにすぐ返す。**
 *
 * 認証フォームは検証ハーネスやテストでも単体で描かれる。そこで `enter()` が
 * 解決しないと、ログイン後の遷移がいつまでも起きない。
 */
const NO_ENTRANCE: EntranceControls = {
  compact: false,
  setWaiting: () => {},
  enter: () => Promise.resolve(),
};

export const EntranceContext = createContext<EntranceControls>(NO_ENTRANCE);

/** 認証画面の地（書斎の扉）への操作。扉の外で呼んでも壊れない。 */
export function useEntrance(): EntranceControls {
  return useContext(EntranceContext);
}

/**
 * 認証が済んで行き先へ移る直前に呼ぶもの。書斎へ向かうなら扉を開けて入り、
 * 扉の手前の画面へ戻るなら何もしない（`staysAtEntrance` の注釈）。
 */
export function useLeaveThroughEntrance(): (destination: string) => Promise<void> {
  const { enter } = useEntrance();
  return useCallback(
    (destination: string) => {
      if (staysAtEntrance(destination)) return Promise.resolve();
      // 歩いて入った先が書斎なら、向こうでカメラが入り口から寄って止まる。
      markStudyArrivalFor(destination);
      return enter();
    },
    [enter],
  );
}
