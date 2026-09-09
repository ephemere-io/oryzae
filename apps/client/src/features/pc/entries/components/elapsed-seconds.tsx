'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useEffect, useState } from 'react';

/**
 * 経過秒数を出す。**実測値だけを出し、残り時間は推定しない。**
 *
 * 「あと何秒」を出すには、この写真・このモデル・この回線での所要時間を知っている必要が
 * あるが、そんな数字はどこにも無い。ハードコードした推定を出すと、外れたときに
 * 「止まっているのか、遅いだけなのか」がかえって分からなくなる。
 *
 * 代わりに「動いていること」と「どれだけ経ったか」という、確かめられる事実だけを出す。
 * これで少なくとも「固まっている」との区別はつく。
 */
export function ElapsedSeconds({
  running,
  label,
}: {
  running: boolean;
  label: (s: string) => string;
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) {
      setSeconds(0);
      return;
    }
    const startedAt = Date.now();
    // 0.1 秒刻みにするのは、数字が動いていること自体が「生きている」証拠になるため。
    const id = setInterval(() => setSeconds((Date.now() - startedAt) / 1000), 100);
    return () => clearInterval(id);
  }, [running]);

  // 待機中も要素自体は残す（中身は空）。消してしまうと読み上げの領域ごと入れ替わり、
  // 走り出したことが伝わらない。
  return (
    <span
      {...verifyAttrs({ unit: 'ElapsedSeconds', running, seconds: seconds.toFixed(1) })}
      className="tabular-nums text-xs text-[var(--date-color)]"
      role="status"
      aria-live="polite"
    >
      {running ? label(seconds.toFixed(1)) : ''}
    </span>
  );
}
