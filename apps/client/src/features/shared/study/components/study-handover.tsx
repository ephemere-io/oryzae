'use client';

// verify-exempt: ルーターの上に敷く地。遷移と sessionStorage が前提で、孤立して描くと常に空。

import { useEffect, useState } from 'react';
import { traceMark } from '@/lib/trace';
import {
  endStudyHandover,
  studyHandoverImage,
  subscribeStudyHandover,
  takePendingStudyHandover,
} from '../handover';

/**
 * 扉から書斎へ渡すあいだ、部屋を画面の上に敷いておく 1 枚。
 *
 * **root layout に置く**（`app/layout.tsx`）。認証レイアウトと保護レイアウトの外側なので、
 * 画面が入れ替わっても外れない — 途中で挟まるロード表示・mount 待ち・canvas の 1 フレーム目
 * 待ちが、どれも画面に出てこない。合図は `handover.ts`（扉が敷き、書斎が引く）。
 *
 * 触れない（`pointer-events-none`）。敷いている間も、下の画面は普通に動いている。
 */
export function StudyHandover() {
  const [image, setImage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** 敷いた絵が、まだ前へ進んでいる最中か（下の `PUSH` の注釈）。 */
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    const stop = subscribeStudyHandover(() => {
      const next = studyHandoverImage();
      if (next === null) {
        // 引き始める。**絵はまだ外さない** — 外すと、そのフレームで下が出てしまう。
        setLeaving(true);
        return;
      }
      setImage(next);
      setLeaving(false);
    });
    // 読み込み直しをまたいで来た場合（OAuth・メール確認のフルページ遷移）。
    const pending = takePendingStudyHandover();
    if (pending !== null) setImage(pending);
    return stop;
  }, []);

  /**
   * 敷いた瞬間から、**絵をそのまま前へ進める**。
   *
   * 扉の側は歩いて着き、書斎はまだ描けていない。その間ずっと静止画だと、歩きが止まって
   * から別の絵へ溶けることになり、「一瞬切れる」と読める（実機レビュー）。撮った絵は
   * 歩いていた目線そのものなので、わずかに寄せ続ければ**歩き続けている**ように見える。
   * 書斎の側も寄りながら現れる（`ARRIVAL`）ので、溶けるあいだも動きが途切れない。
   */
  useEffect(() => {
    if (image === null) return;
    // 次のフレームで始める（同じフレームだと transition が走らない）。
    const id = requestAnimationFrame(() => setPushing(true));
    return () => {
      cancelAnimationFrame(id);
      setPushing(false);
    };
  }, [image]);

  // 引き終わったら外す。
  useEffect(() => {
    if (!leaving || image === null) return;
    const id = window.setTimeout(() => {
      traceMark('地を外した');
      setImage(null);
      setLeaving(false);
    }, FADE_MS);
    return () => window.clearTimeout(id);
  }, [leaving, image]);

  /**
   * 合図が来ないときの保険。
   *
   * 書斎が描けないまま（WebGL 非対応・読み込み失敗）だと、引く合図は永遠に来ない。
   * 敷いたままにすると**アプリが絵で塞がれる**ので、待つのはここまでにする。
   */
  useEffect(() => {
    if (image === null || leaving) return;
    const id = window.setTimeout(() => {
      endStudyHandover();
      setLeaving(true);
    }, HOLD_MAX_MS);
    return () => window.clearTimeout(id);
  }, [image, leaving]);

  if (image === null) return null;

  return (
    // biome-ignore lint/performance/noImgElement: data URL の地。最適化する先が無い
    <img
      src={image}
      alt=""
      aria-hidden="true"
      data-study-handover
      className="pointer-events-none fixed inset-0 z-50 h-full w-full object-cover"
      style={{
        opacity: leaving ? 0 : 1,
        transform: `scale(${pushing ? PUSH.scale : 1})`,
        // 扉の開口は画面のほぼ中央。少し上を中心にすると、床ではなく奥へ進んで見える。
        transformOrigin: '50% 44%',
        transition: `opacity ${FADE_MS}ms ease-out, transform ${PUSH.ms}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    />
  );
}

/** 引くのにかける時間（ms）。書斎はもう描けているので、静かに退く。 */
const FADE_MS = 320;

/**
 * 敷いた絵を前へ進める量と長さ。
 *
 * **止まって見えない程度に、ごく静かに。** 大きく寄せると、撮った 1 枚を拡大したことが
 * 分かってしまう（線が太る）。出だしは速く、着きは緩く（`cubic-bezier`）で、書斎の側の
 * 定置（`ARRIVAL`）と同じ減速にそろえる。
 */
const PUSH = { scale: 1.055, ms: 1400 } as const;

/**
 * 引く合図を待つ上限（ms）。
 *
 * 書斎の canvas が読み込めなかったときの保険。長く取りすぎると、その間ずっと画面が
 * 絵で塞がれて見える（触れはする）。
 */
const HOLD_MAX_MS = 4000;
