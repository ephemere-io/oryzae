'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useCallback } from 'react';
import type { ResizeCorner } from '@/features/shared/board/selection';
import type { Bounds } from '@/lib/canvas/viewport';
import { HANDLE_SIZE, hairline, INVERSE_SCALE } from './board-surface';

interface SelectionFrameProps {
  /** 選んでいるカードを囲む world 矩形。 */
  bounds: Bounds;
  /** 何枚選んでいるか。枚数の表示に使う。 */
  count: number;
  onResizeStart: (corner: ResizeCorner, clientX: number, clientY: number) => void;
}

const CORNERS: ResizeCorner[] = ['nw', 'ne', 'sw', 'se'];

/**
 * 複数選択しているときに出る、群を囲む枠。
 *
 * **枠そのものは指を通す**（`pointer-events: none`）。塞いでしまうと、選んだカードを
 * 掴んで群ごと動かすことができなくなる——枠は「どこまでが選択か」を見せるだけで、
 * 掴めるのは角のつまみだけにする。
 *
 * つまみを 4 隅に出し、掴んだ角の反対側を固定して**等方に**拡大縮小する
 * （算数は `features/shared/board/selection`）。回転は出さない: カードごとに傾きが
 * 違う群をまとめて回すと、どの点を中心に何が起きるのか予想できない。
 */
export function SelectionFrame({ bounds, count, onResizeStart }: SelectionFrameProps) {
  const handleDown = useCallback(
    (corner: ResizeCorner) => (e: React.PointerEvent) => {
      e.stopPropagation();
      onResizeStart(corner, e.clientX, e.clientY);
    },
    [onResizeStart],
  );

  return (
    <div
      {...verifyAttrs({ unit: 'SelectionFrame', count, width: Math.round(bounds.width) })}
      // 枠は見せるだけ。掴めるのは下の子（つまみ）だけにする。
      className="pointer-events-none absolute"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        // カード(最大 z)より上、ドラッグ中(1000)より下。
        zIndex: 900,
        border: `${hairline(1)} dashed var(--accent)`,
        borderRadius: 2,
      }}
    >
      {/* 枚数。選んだつもりの数と合っているかを確かめる手がかり。
          読み上げには出さない——同じ枚数を道具箱が文字で持っており、二重になる。

          **上辺の中央**に置く。左上に出していたころは、同じ角にある `nw` のつまみが
          数字の上に完全に乗って読めなかった（実ビルドで確認）。四隅はつまみの席なので、
          文字は辺の真ん中という空いている場所に出す。 */}
      <span
        data-verify-part="count"
        aria-hidden="true"
        className="absolute whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-medium leading-none tracking-[0.04em]"
        style={{
          bottom: '100%',
          left: '50%',
          // 枠の上端に下辺を合わせ、倍率に負けない分だけ上に離す。
          marginBottom: hairline(6),
          transform: `translateX(-50%) ${INVERSE_SCALE}`,
          transformOrigin: 'bottom center',
          backgroundColor: 'var(--accent)',
          color: '#fff',
        }}
      >
        {count}
      </span>

      {CORNERS.map((corner) => {
        const style: React.CSSProperties = {
          position: 'absolute',
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          backgroundColor: 'var(--bg)',
          border: `1.5px solid var(--accent)`,
          borderRadius: 2,
          cursor: `${corner}-resize`,
          // 枠は指を通すので、つまみだけ受け取りに戻す。
          pointerEvents: 'auto',
          transform: INVERSE_SCALE,
        };
        if (corner.includes('s')) style.bottom = -10;
        if (corner.includes('n')) style.top = -10;
        if (corner.includes('e')) style.right = -10;
        if (corner.includes('w')) style.left = -10;

        return (
          <div
            key={corner}
            // 掴んだら盤面のパンを始めない。
            data-canvas-no-pan=""
            data-verify-handle={corner}
            onPointerDown={handleDown(corner)}
            // つまみの上で離したときの click を盤面まで上げない（盤面の click は
            // 「空きを押した＝選択解除」）。**つまみから離れた場所で離したときは
            // click が共通の親に飛ぶのでここでは止まらない**——そちらは盤面側が
            // 「動かした直後の click は数えない」で受けている（board-view）。
            onClick={(e) => e.stopPropagation()}
            style={style}
          />
        );
      })}
    </div>
  );
}
