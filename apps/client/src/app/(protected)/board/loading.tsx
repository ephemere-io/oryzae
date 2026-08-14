'use client';

import { BoardRouteSkeleton } from '../_skeletons/board-route-skeleton';

/** `/board` の遷移ローディング。盤面（方眼＋四隅の chrome）の枠を出す。 */
export default function Loading() {
  return <BoardRouteSkeleton />;
}
