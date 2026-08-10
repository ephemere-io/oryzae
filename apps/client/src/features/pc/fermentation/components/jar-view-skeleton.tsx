import { verifyAttrs } from '@oryzae/verify';
import {
  CIRCLE_FALLBACK_POSITIONS,
  CIRCLE_SIZE,
  JAR_BOX,
  JAR_GRID_BACKGROUND,
  JAR_PATH,
  JAR_RADIAL_BACKGROUND,
} from '@/features/pc/fermentation/utils/jar-shape';

/**
 * PC 瓶（JarView）のスケルトン。
 *
 * /jar は一覧ではなく**全面キャンバス**（中央に瓶、その周囲に問いの円）。ここに一覧の
 * 行枠を出していたのが今回の作り直しの発端で、読み込み完了時に画面が丸ごと入れ替わっていた。
 *
 * 方針:
 *  - 背景（グリッド／放射グラデ）はデータに依存しないので**本物をそのまま描く**。
 *    枠ではなく本物なので、読み込み完了時に一切変化しない。
 *  - 瓶は本物と同じ `JAR_PATH` の輪郭を薄く塗って置く（主役の位置・大きさを先に確定させる）。
 *  - 問いの円は既定配置（`CIRCLE_FALLBACK_POSITIONS`）に同じ直径の円で置く。実際の数は
 *    取得するまで分からないため、既定の上限3件ぶんを薄く出す。
 */
export function JarViewSkeleton({ circles = 3 }: { circles?: number }) {
  const shown = CIRCLE_FALLBACK_POSITIONS.slice(0, Math.max(0, circles));

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[var(--bg)]"
      aria-hidden="true"
      {...verifyAttrs({
        unit: 'JarViewSkeleton',
        slots: 'canvas,jar',
        circles: shown.length,
      })}
    >
      {/* 背景（本物と同一。データ非依存なので枠ではなく実物を描く） */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        data-skeleton-slot="canvas"
        style={{
          backgroundImage: JAR_GRID_BACKGROUND,
          backgroundSize: '40px 40px',
          backgroundPosition: 'center center',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: JAR_RADIAL_BACKGROUND }}
      />

      {/* 中央の瓶（本物と同じ輪郭・同じ寸法／位置） */}
      <div className="pointer-events-none absolute z-[2]" style={JAR_BOX} data-skeleton-slot="jar">
        <svg
          aria-hidden="true"
          className="h-full w-full animate-pulse"
          viewBox="0 0 480 600"
          fill="none"
        >
          {/* 塗りは Skeleton 片と同じ重さ（--border-subtle）に揃える */}
          <path
            d={JAR_PATH}
            fill="var(--border-subtle)"
            stroke="var(--border-subtle)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* 問いの円（既定配置・同じ直径） */}
      {shown.map((pos) => (
        <div
          key={`${pos.x}-${pos.y}`}
          className="pointer-events-none absolute z-[1] animate-pulse rounded-full"
          data-skeleton-slot="circle"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            width: CIRCLE_SIZE,
            height: CIRCLE_SIZE,
            transform: 'translate(-50%, -50%)',
            border: '1px dashed var(--border-subtle)',
            background: 'radial-gradient(circle, var(--border-subtle) 0%, transparent 65%)',
          }}
        />
      ))}
    </div>
  );
}
