'use client';

import { BoardRouteLoading } from '../_loading/board-route-loading';

/** `/board` の遷移ローディング。盤面（方眼＋四隅の chrome）の枠を出す。 */
export default function Loading() {
  return <BoardRouteLoading />;
}
