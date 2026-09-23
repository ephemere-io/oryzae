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
  /** 受け皿ごと前へ進めている最中か（下の `PUSH` の注釈）。 */
  const [pushing, setPushing] = useState(false);
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

  /**
   * 載せた瞬間から、**受け皿ごと前へ進める**（CSS の transform）。
   *
   * 中の canvas は歩き続けているが、それは rAF、つまりメインスレッドの仕事。書斎が
   * 最初の 1 フレームを描いた直後にメインスレッドが 200ms 以上塞がることがあり
   * （本番ビルドの計測で 246ms）、その間は canvas の絵が止まる。transform の transition は
   * compositor が進めるので、**JS が止まっていても動き続ける**。中の歩きに、止まらない
   * 前進をもう 1 枚重ねておく。
   *
   * 出だしはゆっくり（`cubic-bezier(0.4, 0, 0.2, 1)`）。速く始めると、載せた瞬間に速度が
   * 跳ねて、それ自体が「カクッ」になる。
   */
  useEffect(() => {
    if (bridge === null) return;
    // 次のフレームで始める（同じフレームだと transition が走らない）。
    const id = requestAnimationFrame(() => setPushing(true));
    return () => {
      cancelAnimationFrame(id);
      setPushing(false);
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
      style={{
        opacity: leaving ? 0 : 1,
        transform: `scale(${leaving ? PUSH.exitScale : pushing ? PUSH.scale : 1})`,
        // 扉の開口は画面のほぼ中央。少し上を中心にすると、床ではなく奥へ進んで見える。
        transformOrigin: '50% 45%',
        transition: leaving
          ? // 溶けるあいだは**さらに前へ抜ける**。枠が画面の外へ広がりながら消えるので、
            // 「扉の絵が書斎の絵に入れ替わった」ではなく「くぐり抜けた」に見える。
            `opacity ${FADE_MS}ms ease-out, transform ${FADE_MS}ms cubic-bezier(0.3, 0, 0.1, 1)`
          : `opacity ${FADE_MS}ms ease-out, transform ${PUSH.ms}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        willChange: 'transform, opacity',
      }}
    />
  );
}

/**
 * 溶かすのにかける時間（ms）。
 *
 * **長いほど 2 つの動きが重なる**ので、切り替わりが目立たない。短いと、扉の絵から書斎の絵へ
 * 「入れ替わった」瞬間が読める（実機レビュー「もっとスムーズにしたい」）。
 */
const FADE_MS = 560;

/**
 * 受け皿ごと前へ進める量と長さ。
 *
 * 中の歩きに重ねるぶんなので、ごく小さく。大きくすると canvas を拡大していることが
 * 分かる（線が太る）。長さは、載ってから溶け終わるまで（遅い端末でも）を覆う。
 */
const PUSH = {
  scale: 1.05,
  ms: 1800,
  /** 溶けるあいだに抜ける先。枠を画面の外へ送り出すぶんだけ大きく取る。 */
  exitScale: 1.22,
} as const;

/**
 * 引く合図を待つ上限（ms）。
 *
 * 書斎の canvas が読み込めなかったときの保険。長く取りすぎると、その間ずっと画面が
 * 扉の canvas で塞がれて見える（触れはする）。
 */
const HOLD_MAX_MS = 4000;
