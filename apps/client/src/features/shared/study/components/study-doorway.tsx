'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { OVERZOOM_OUT_EVENT, type OverzoomOutDetail } from '@/lib/canvas/viewport';
import { readStudyBackdrop } from '../backdrop';
import { DOORWAY, PULL_BACK } from '../constants';

/**
 * サブ画面の下端に覗く**部屋そのもの**。押すと戻り、引くと育って戻る。
 *
 * ### なぜ「ボタン」を置かないか
 *
 * 出口は 4 度置き直している。左上のマーク（3 巡ぶん「既存の操作に被る」）→ 下端の
 * ピル（「パレットの真下で被りそう」）→ 下端の細い印（「見にくい」）→ 上端の矢印と
 * 小さい字（「気づきにくい」「字が小さい」「**どこにも出てこないデザイン言語**」）。
 *
 * 最後の指摘が芯だと思う。**この製品に「矢印＋小さい字」という語彙は無い。** 浮いて
 * 押せるものは擦りガラスの面（パレット・ツールバー）で、部屋の中で名前を言うのは
 * 点＋機械ラベル。出口をそのどちらかに寄せると、今度はパレットと語彙が衝突して
 * 「どっちが道具でどっちが出口か」になる。
 *
 * **だから記号を作るのをやめ、行き先そのものを見せる。** 出ていく直前に撮ってある
 * 部屋（`backdrop.ts`）を下端に帯として覗かせる。「部屋は下にある」という絵は、
 * 新しい語彙をひとつも増やさずに行き先を名乗る。
 *
 * ### 押す道と引く道が 1 つになる
 *
 * これまで「押して戻る」と「引いて戻る」は別々の仕掛けだった。帯にすると同じものの
 * 2 つの触り方になる — 押せば開き、引けば（`OVERZOOM_OUT_EVENT`）帯が育って開く。
 * 途中で手を止めれば帯は元の高さへ戻る（可逆であることは変わらない）。
 *
 * ### 隅は避ける
 *
 * 全幅にはしない。ボードと瓶は左下に倍率、右下にミニマップを置いていて、全幅の帯は
 * その上に乗ってしまう。中央だけを使えば、どの画面の操作とも取り合わない。
 */
export function StudyDoorway() {
  const t = useTranslations('study');
  const [progress, setProgress] = useState(0);
  const [backdrop, setBackdrop] = useState<string | null>(null);

  // 毎フレーム書き換える値は ref で持つ。イベント 1 回ごとに再描画すると、
  // 引いている最中に板の再描画が挟まって指に付いてこない。
  const progressRef = useRef(0);
  const leavingRef = useRef(false);

  useEffect(() => setBackdrop(readStudyBackdrop()), []);

  useEffect(() => {
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
        // 開ききった。以降の引きは受けない（連打で二重に遷移させない）。
        leavingRef.current = true;
        window.location.assign('/study');
      }
    }

    /**
     * 手を止めたら戻す。
     *
     * **止めた瞬間ではなく、少し待ってから戻し始める。** ホイールもトラックパッドも
     * イベントが飛び飛びに来るので、間が空いたそばから戻すと帯が点滅する。
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
  }, []);

  // 引くほど、帯が画面いっぱいへ育つ。開ききった姿は書斎そのものと同じ大きさなので、
  // そこから /study へ移っても絵が跳ねない。
  const height = DOORWAY.restHeight + (window_innerHeight() - DOORWAY.restHeight) * progress;
  const width = `calc(${DOORWAY.restWidth} + (100% - ${DOORWAY.restWidth}) * ${progress})`;
  const radius = DOORWAY.restRadius * (1 - progress);

  return (
    <div
      {...verifyAttrs({
        unit: 'StudyDoorway',
        remembered: backdrop !== null,
        pulling: progress > 0,
      })}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[54] flex justify-center"
    >
      <Link
        href="/study"
        aria-label={t('back_to_study')}
        className="pointer-events-auto group relative block overflow-hidden"
        style={{
          width,
          maxWidth: '100%',
          height,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          // 部屋の地。憶えていないときはこれだけになる（帯としては成立する）。
          background: DOORWAY.ground,
          // 引いている最中は指に付いてこないと嘘になるので、transition は掛けない。
          transition: progress === 0 ? `height ${DOORWAY.settleMs}ms ease-out` : undefined,
          boxShadow: '0 -2px 18px rgba(140, 133, 126, 0.16)',
        }}
      >
        {backdrop === null ? null : (
          /**
           * **画面いっぱいの大きさで置き、帯が下から切り取る。**
           *
           * 帯の中に縮めて入れると、育つたびに絵の縮尺が変わって部屋が動いて見える。
           * 常に「開ききった姿」で置いておけば、育つのは覗き窓のほうだけになる。
           */
          // biome-ignore lint/performance/noImgElement: data URL の地。最適化する先が無い
          <img
            src={backdrop}
            alt=""
            aria-hidden="true"
            data-study-backdrop
            className="absolute bottom-0 left-1/2 max-w-none -translate-x-1/2 object-cover"
            style={{ width: '100vw', height: '100vh' }}
          />
        )}

        {/* 上端の一本。ここが画面の縁ではなく「部屋との境目」だと分かる。 */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'rgba(122, 116, 64, 0.22)' }}
        />

        {/* 名前。引き始めたら退く（部屋が出てくれば言葉は要らない）。 */}
        <span
          className="absolute inset-x-0 top-0 flex items-center justify-center transition-opacity duration-200"
          style={{
            height: DOORWAY.restHeight,
            opacity: progress > 0.06 ? 0 : 1,
            fontSize: DOORWAY.labelSize,
            letterSpacing: '0.14em',
            color: '#5C4F3F',
          }}
        >
          {t('back_to_study')}
        </span>
      </Link>
    </div>
  );
}

/** SSR では窓の高さが無い。開ききった高さは描画後に決まればよい。 */
function window_innerHeight(): number {
  return typeof window === 'undefined' ? 0 : window.innerHeight;
}
