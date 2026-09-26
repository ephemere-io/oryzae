'use client';

import { useEffect, useState } from 'react';

/**
 * 読み込み中の枠を出すまでの猶予（ms）。これより早く返れば枠を出さない（ちらつかせない）。
 *
 * アプリ全体の読み込みの作法: 骨組み（`components/ui/skeleton`）は「いずれ出るレイアウトを
 * 先に置く」ためのもので、一瞬で返る取得にまで出すと、逆に画面が一度揺れる。
 */
const LOADING_GRACE_MS = 150;

/**
 * `flag` が `delayMs` 以上続いたときだけ true。`flag` が false に戻れば即 false。
 *
 * 使い方: `const showSkeleton = useDelayedTrue(loading);`
 */
export function useDelayedTrue(flag: boolean, delayMs: number = LOADING_GRACE_MS): boolean {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!flag) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [flag, delayMs]);
  return flag && delayed;
}
