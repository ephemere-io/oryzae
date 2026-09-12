import { verifyAttrs } from '@oryzae/verify';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * SP 瓶（SpJar）のスケルトン。
 *
 * SP の /jar は「中央の壜と、まわりに散らばる問いの円（地図）」。一覧ではないので、
 * 行の枠を置くと到着時に画面が丸ごと入れ替わって見える。壜の位置と円の散らばりを
 * 先に置いて、実物が来たときに色と文字が乗るだけにする。
 *
 * 2粒度を公開する:
 *  - `SpJarMapSkeleton` … 壜と円だけ。SpJar 本体がボタンを実物で描いている最中に使う。
 *  - `SpJarSkeleton` … 画面まるごと。ページ遷移/初回描画の枠に使う。
 */

/**
 * 円の散らばり。実物の既定の席（世界の 80%/22%・72%/72%・14%/46%）を、初期表示の範囲
 * （中央 1500×1040）に写したもの。
 */
const CIRCLE_SLOTS = [
  { left: '86%', top: '18%', size: 92 },
  { left: '74%', top: '84%', size: 92 },
  { left: '10%', top: '48%', size: 92 },
];

/** 壜と円だけ（実物: 中央の壜＋散らばる円）。 */
export function SpJarMapSkeleton({ circles = 3 }: { circles?: number }) {
  return (
    <div className="relative flex-1 overflow-hidden" data-skeleton-slot="orbit" aria-hidden="true">
      {/* 壜（実物: 初期表示で幅の 33% ほどを中央に） */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '47%',
          transform: 'translate(-50%, -50%)',
          width: '34%',
          height: '40%',
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
          }}
        >
          <Skeleton className="h-full w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** 画面まるごと（壜と円 ＋ 下部のボタン。見出しは実物にも無い）。 */
export function SpJarSkeleton({ circles = 3 }: { circles?: number }) {
  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({ unit: 'SpJarSkeleton', slots: 'orbit,jar,manage', circles })}
    >
      <SpJarMapSkeleton circles={circles} />

      {/* 問いを追加・編集するボタン（実物: 下部中央のチップ、角丸 16） */}
      <div className="flex justify-center px-5 pb-6 pt-2" data-skeleton-slot="manage">
        <Skeleton className="h-11 w-40 rounded-2xl" />
      </div>
    </div>
  );
}
