import { verifyAttrs } from '@oryzae/verify';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * SP 瓶（SpJar）のスケルトン。
 *
 * SP の /jar は「中央の壜と、そのまわりを回る問いの円」。一覧ではないので、
 * 行の枠を置くと到着時に画面が丸ごと入れ替わって見える。壜の位置と円の並びを
 * 先に置いて、実物が来たときに色と文字が乗るだけにする。
 *
 * 2粒度を公開する:
 *  - `SpJarOrbitSkeleton` … 壜と円だけ。SpJar 本体がヘッダを実物で描いている最中に使う。
 *  - `SpJarSkeleton` … 画面まるごと。ページ遷移/初回描画の枠に使う。
 */

/**
 * 軌道上の円の並び（実物と同じく、手前が大きく奥が小さい）。
 * 位置は sp-jar-orbit の軌道（中心 52%・横半径 33%・縦半径 58px）を写したもの。
 */
const CIRCLE_SLOTS = [
  { left: '50%', top: '64%', size: 138, opacity: 1 },
  { left: '83%', top: '46%', size: 100, opacity: 0.62 },
  { left: '17%', top: '46%', size: 100, opacity: 0.62 },
];

/** 壜と円だけ（実物: 中央の壜＋軌道上の円）。 */
export function SpJarOrbitSkeleton({ circles = 3 }: { circles?: number }) {
  return (
    <div className="relative flex-1 overflow-hidden" data-skeleton-slot="orbit" aria-hidden="true">
      {/* 壜（実物: 幅 58% / 高さ 62% を中央 47% に置く） */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '47%',
          transform: 'translate(-50%, -50%)',
          width: '62%',
          height: '68%',
        }}
        data-skeleton-slot="jar"
      >
        <Skeleton className="h-full w-full rounded-[40%_40%_45%_45%/30%_30%_55%_55%]" />
      </div>

      {CIRCLE_SLOTS.slice(0, circles).map((slot) => (
        <div
          key={`${slot.left}-${slot.top}`}
          className="absolute"
          style={{
            left: slot.left,
            top: slot.top,
            width: `${slot.size}px`,
            height: `${slot.size}px`,
            marginLeft: `${-slot.size / 2}px`,
            marginTop: `${-slot.size / 2}px`,
            opacity: slot.opacity,
          }}
        >
          <Skeleton className="h-full w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** 画面まるごと（ヘッダ ＋ 壜と円 ＋ 下部のボタン）。 */
export function SpJarSkeleton({ circles = 3 }: { circles?: number }) {
  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({ unit: 'SpJarSkeleton', slots: 'header,orbit,jar,manage', circles })}
    >
      {/* ヘッダ（実物: px-5 pt-6 pb-2 text-lg・中央寄せ） */}
      <div className="flex justify-center px-5 pt-6 pb-2" data-skeleton-slot="header">
        <Skeleton className="h-[22px] w-20" />
      </div>

      <SpJarOrbitSkeleton circles={circles} />

      {/* 問いを整えるボタン（実物: 下部中央の丸いピル） */}
      <div className="flex justify-center px-5 pb-7" data-skeleton-slot="manage">
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
    </div>
  );
}
