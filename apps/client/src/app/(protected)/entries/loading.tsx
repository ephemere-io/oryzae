'use client';

import { EntriesRouteSkeleton } from '../_skeletons/entries-route-skeleton';

/**
 * `/entries` の遷移ローディング。ルートごとに `loading.tsx` を置くことで、Next が
 * **行き先のセグメントの枠**を出す（ルートグループに1枚だけ置くと、どの画面へ移動しても
 * 同じ枠＝一覧の枠が出てしまう。それが「/jar でも一覧のスケルトンが出る」原因だった）。
 */
export default function Loading() {
  return <EntriesRouteSkeleton />;
}
