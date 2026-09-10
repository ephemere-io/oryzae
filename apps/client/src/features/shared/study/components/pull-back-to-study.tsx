'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { OVERZOOM_OUT_EVENT, type OverzoomOutDetail } from '@/lib/canvas/viewport';
import { readStudyBackdrop } from '../backdrop';
import { PULL_BACK } from '../constants';

/**
 * 「これ以上引けないところから、もう一段引く」と書斎へ戻る。
 *
 * **入りが寄りなら、出は引き。** 瓶へは左へパンして寄り、板へは正対して詰め、手帳は
 * 見開きへ寄って入る。だから出も同じ軸の逆であるべきで、隅に置いたボタンではない
 * （ボタン・サイドバー・パンくずは「画面が並んでいる」前提の道具で、1 つの空間を
 * 寄り引きしているこの体験とは語彙が合わない）。
 *
 * キャンバスは最小倍率で頭打ちになる。そこから先の引きは行き場が無いので、その余りを
 * `OVERZOOM_OUT_EVENT` で受け取り、**部屋が滲み出てくる**ことに使う。
 *
 * **可逆であることが肝。** 途中で手を止めれば滲みは引いて元に戻る。引き切って初めて
 * 書斎に着く。戻れると分かっているから「ちょっと引いてみる」が試せて、そこで発見される
 * — 使い方を説明する場所がどこにも無い体験なので、ここが唯一の入口になる。
 *
 * 置き場が `features/shared/study` なのは、この仕掛けが存在する理由が書斎だから。
 * 出し分けと重ねるのは `(protected)/layout.tsx` の仕事で、板や瓶の画面そのものには
 * 触れない（触れると reach-slice-isolation にも当たる）。
 */
export function PullBackToStudy() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [backdrop, setBackdrop] = useState<string | null>(null);

  // 毎フレーム書き換える値は ref で持つ。イベント 1 回ごとに再描画すると、
  // 引いている最中に板の再描画が挟まって指に付いてこない。
  const progressRef = useRef(0);
  const leavingRef = useRef(false);

  useEffect(() => setBackdrop(readStudyBackdrop()), []);

  useEffect(() => {
    // 憶えた部屋が無ければ、そもそも受けない。滲ませる絵が無いまま引けてしまうと、
    // 手応えの無いまま画面が変わる。
    if (backdrop === null) return;

    let frame = 0;
    let lastEventAt = 0;

    function publish(next: number): void {
      progressRef.current = next;
      setProgress(next);
    }

    function onOverzoom(event: Event): void {
      if (leavingRef.current) return;
      if (!(event instanceof CustomEvent)) return;
      const detail: OverzoomOutDetail | undefined = event.detail;
      const excess = detail?.excess;
      if (typeof excess !== 'number' || !Number.isFinite(excess) || excess <= 0) return;

      lastEventAt = performance.now();
      const next = Math.min(1, progressRef.current + excess * PULL_BACK.gain);
      publish(next);

      if (next >= 1) {
        // 着いた。以降の引きは受けない（連打で二重に遷移させない）。
        leavingRef.current = true;
        router.push('/study');
      }
    }

    /**
     * 手を止めたら戻す。
     *
     * **止めた瞬間ではなく、少し待ってから戻し始める。** ホイールもトラックパッドも
     * イベントが一定間隔で飛び飛びに来るので、間が空いたそばから戻すと、引いている
     * 最中なのに滲みが点滅する。
     */
    function decay(): void {
      frame = requestAnimationFrame(decay);
      if (leavingRef.current || progressRef.current === 0) return;
      if (performance.now() - lastEventAt < PULL_BACK.holdMs) return;
      const next = progressRef.current - PULL_BACK.decayPerFrame;
      publish(next > 0 ? next : 0);
    }

    window.addEventListener(OVERZOOM_OUT_EVENT, onOverzoom);
    frame = requestAnimationFrame(decay);
    return () => {
      window.removeEventListener(OVERZOOM_OUT_EVENT, onOverzoom);
      cancelAnimationFrame(frame);
    };
  }, [router, backdrop]);

  /**
   * **憶えた部屋が無くても、層と契約は出す。**
   *
   * 「何も描かない」で返すと `data-verify-*` ごと消え、検証ハーネスから見て
   * 「表面が無い」＝読めるものが無いユニットになる。効いていない状態も状態なので、
   * `armed` として名乗る。空の層は透明で当たりも持たないので、下の操作は何も奪わない。
   */
  return (
    <div
      {...verifyAttrs({
        unit: 'PullBackToStudy',
        armed: backdrop !== null,
        pulling: progress > 0,
      })}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[54] overflow-hidden"
      style={{ opacity: progress }}
    >
      {backdrop === null ? null : (
        <>
          {/* 引くほど部屋が近づく。引き始めは少し寄った状態から、引き切ると等倍へ。 */}
          {/* biome-ignore lint/performance/noImgElement: data URL の地。最適化する先が無い */}
          <img
            src={backdrop}
            alt=""
            data-study-backdrop
            className="h-full w-full object-cover"
            style={{
              transform: `scale(${PULL_BACK.startScale - (PULL_BACK.startScale - 1) * progress})`,
              filter: `blur(${PULL_BACK.startBlurPx * (1 - progress)}px)`,
            }}
          />
        </>
      )}
    </div>
  );
}
