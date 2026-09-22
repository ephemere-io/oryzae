'use client';

// verify-exempt: ルーターの上に載せる canvas の受け皿。遷移と WebGL が前提で、孤立して描くと常に空。

import { useEffect, useRef, useState } from 'react';
import { traceMark } from '@/lib/trace';
import {
  endStudyHandover,
  type StudyBridge,
  studyHandoverBridge,
  subscribeStudyHandover,
} from '../handover';

/**
 * 扉から書斎へ渡すあいだ、**歩いている canvas をそのまま**画面の上に載せておく受け皿。
 *
 * **root layout に置く**（`app/layout.tsx`）。認証レイアウトと保護レイアウトの外側なので、
 * 画面が入れ替わっても外れない — 途中で挟まるロード表示・mount 待ち・canvas の 1 フレーム目
 * 待ちが、どれも画面に出てこない。合図は `handover.ts`（扉が載せ、書斎が引く）。
 *
 * 載せるのは写真ではなく canvas そのもの。扉のシーンは歩き続けているので（`glideView`）、
 * 画面が入れ替わっても動きは 1 本のまま。書斎が描けたら溶かして、それから捨てる。
 *
 * 触れない（`pointer-events-none`）。載せている間も、下の画面は普通に動いている。
 */
export function StudyHandover() {
  const [bridge, setBridge] = useState<StudyBridge | null>(null);
  const [leaving, setLeaving] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeStudyHandover(() => {
        const next = studyHandoverBridge();
        if (next === null) {
          // 引き始める。**canvas はまだ外さない** — 外すと、そのフレームで下が出てしまう。
          setLeaving(true);
          return;
        }
        setBridge((previous) => {
          if (previous !== null && previous !== next) previous.dispose();
          return next;
        });
        setLeaving(false);
      }),
    [],
  );

  // 持ち出された canvas を受け皿に載せる。描き続けているので、載せ替えても動きは切れない。
  useEffect(() => {
    const host = hostRef.current;
    if (host === null || bridge === null) return;
    const { canvas } = bridge;
    canvas.style.display = 'block';
    host.appendChild(canvas);
    return () => {
      if (canvas.parentNode === host) host.removeChild(canvas);
    };
  }, [bridge]);

  // 溶かし終えたら外して捨てる（renderer と WebGL のコンテキストを返す）。
  useEffect(() => {
    if (!leaving || bridge === null) return;
    const id = window.setTimeout(() => {
      traceMark('扉の canvas を外した');
      bridge.dispose();
      setBridge(null);
      setLeaving(false);
    }, FADE_MS);
    return () => window.clearTimeout(id);
  }, [leaving, bridge]);

  /**
   * 合図が来ないときの保険。
   *
   * 書斎が描けないまま（WebGL 非対応・読み込み失敗）だと、引く合図は永遠に来ない。
   * 載せたままにすると**アプリが canvas で塞がれる**ので、待つのはここまでにする。
   */
  useEffect(() => {
    if (bridge === null || leaving) return;
    const id = window.setTimeout(() => {
      endStudyHandover();
      setLeaving(true);
    }, HOLD_MAX_MS);
    return () => window.clearTimeout(id);
  }, [bridge, leaving]);

  if (bridge === null) return null;

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-study-handover
      className="pointer-events-none fixed inset-0 z-50"
      style={{ opacity: leaving ? 0 : 1, transition: `opacity ${FADE_MS}ms ease-out` }}
    />
  );
}

/** 溶かすのにかける時間（ms）。書斎はもう描けているので、静かに退く。 */
const FADE_MS = 360;

/**
 * 引く合図を待つ上限（ms）。
 *
 * 書斎の canvas が読み込めなかったときの保険。長く取りすぎると、その間ずっと画面が
 * 扉の canvas で塞がれて見える（触れはする）。
 */
const HOLD_MAX_MS = 4000;
