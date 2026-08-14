import { verifyAttrs } from '@oryzae/verify';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * PC ボード（BoardView）のスケルトン。
 *
 * ボードは一覧でもエディタでもなく、**方眼の盤面に紙片が散らばる**画面。四隅の chrome
 * （左上の日付ナビ・右上の表示切替・右下のカード数）が先に決まっていれば、
 * カードが届いても画面の骨格は動かない。
 *
 * 背景の方眼はデータに依存しないので本物をそのまま描く（読み込み完了時に変化しない）。
 * カードは位置・サイズがサーバー保存のレイアウト依存なので、代表的な散らばり方を
 * 薄く置くだけに留める（本物の位置は当てられない）。
 */

/** 方眼の背景（BoardView 本体と同一指定）。 */
const GRID_BACKGROUND =
  'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)';

/** 代表的なカードの散らばり（実カードは x/y/width/height/rotation を持つ）。 */
const CARD_PLACEHOLDERS = [
  { left: 80, top: 110, width: 220, height: 170, rotate: -2 },
  { left: 360, top: 90, width: 200, height: 210, rotate: 1.5 },
  { left: 620, top: 150, width: 240, height: 160, rotate: -1 },
  { left: 200, top: 350, width: 210, height: 190, rotate: 2 },
  { left: 500, top: 400, width: 230, height: 150, rotate: -1.5 },
];

export function BoardViewSkeleton({ cards = CARD_PLACEHOLDERS.length }: { cards?: number }) {
  const shown = CARD_PLACEHOLDERS.slice(0, Math.max(0, cards));

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      aria-hidden="true"
      style={{ backgroundColor: 'var(--bg)' }}
      {...verifyAttrs({
        unit: 'BoardViewSkeleton',
        slots: 'canvas,date-nav,controls,card-count',
        cards: shown.length,
      })}
    >
      {/* 方眼（本物と同一。データ非依存なので枠ではなく実物を描く） */}
      <div
        className="pointer-events-none absolute inset-0"
        data-skeleton-slot="canvas"
        style={{ backgroundImage: GRID_BACKGROUND, backgroundSize: '40px 40px', opacity: 0.6 }}
      />

      {/* 左上: 日付ナビ（実物: absolute left-6 top-5、← ラベル →） */}
      <div
        className="absolute left-6 top-5 z-10 flex items-center gap-3"
        data-skeleton-slot="date-nav"
      >
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>

      {/* 右上: 表示切替＋追加（実物: absolute right-6 top-5、pill が4つ） */}
      <div
        className="absolute right-6 top-5 z-10 flex items-center gap-2"
        data-skeleton-slot="controls"
      >
        <Skeleton className="h-[22px] w-16 rounded-full" />
        <Skeleton className="h-[22px] w-16 rounded-full" />
        <Skeleton className="h-[22px] w-20 rounded-full" />
        <Skeleton className="h-[22px] w-20 rounded-full" />
      </div>

      {/* 盤面のカード */}
      {shown.map((c) => (
        <div
          key={`${c.left}-${c.top}`}
          className="absolute animate-pulse rounded-sm bg-[var(--border-subtle)] opacity-70"
          data-skeleton-slot="card"
          style={{
            left: c.left,
            top: c.top,
            width: c.width,
            height: c.height,
            transform: `rotate(${c.rotate}deg)`,
          }}
        />
      ))}

      {/* 右下: カード数（実物: absolute bottom-2 right-4 text-[10px]） */}
      <div className="absolute bottom-2 right-4 z-10" data-skeleton-slot="card-count">
        <Skeleton className="h-2.5 w-14" />
      </div>
    </div>
  );
}
