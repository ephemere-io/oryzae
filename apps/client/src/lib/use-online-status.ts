'use client';

import { useEffect, useState } from 'react';

/**
 * いまネットに繋がっているか（ブラウザの見立て）。
 *
 * `navigator.onLine` は「確実に切れている」ことだけ信用できる（true でも届かないことはある）。
 * だから保存の側は失敗も見る（`useAutosaveEntry` の再送）。ここは状態の表示と、復帰の合図
 * （`online`）を取るためのもの。SSR では true。
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
