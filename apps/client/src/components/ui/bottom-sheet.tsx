'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONTROL_FONT } from './surface';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** 読み上げ用の名前。 */
  ariaLabel: string;
  /** 見出し（左上の小さなラベル）。 */
  label?: string;
  closeLabel: string;
  /**
   * 止まる高さ（親の高さに対する比、小さい順）。既定は 45% と 92%。
   * Google マップのシートと同じで、つまみを引けばこの間を行き来する。
   */
  detents?: readonly number[];
  /** 最初に止まる段（`detents` の添字）。 */
  initialDetent?: number;
  children: React.ReactNode;
}

/** これより下へ引き下げたら閉じる（px）。 */
const CLOSE_PULL = 80;

/** つまみを引いた距離がこれ未満なら「押した」扱い（段を変えない）。 */
const DRAG_SLOP = 4;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 下から出て、**つまみで高さを変えられる**セミモーダル（Google マップの作法）。
 *
 * - 段（detents）の間を指で行き来し、離した位置に近い段へ寄る
 * - いちばん低い段からさらに引き下げると閉じる。背景を押しても閉じる
 * - 中身は常にスクロールできる。引くのはつまみと見出しの行だけ（中身のスクロールと
 *   取り合わない）
 *
 * `absolute inset-0` で親（`position: relative`）を覆うので、画面全体ではなく
 * 置いた画面の中で開く（SP のシェルの上段は隠さない）。
 */
export function BottomSheet({
  open,
  onClose,
  ariaLabel,
  label,
  closeLabel,
  detents = [0.45, 0.92],
  initialDetent = 0,
  children,
}: BottomSheetProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [detent, setDetent] = useState(initialDetent);
  /** 引いている最中の高さ（px）。null なら段の高さ。 */
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => setReduced(prefersReducedMotion()), []);

  // 開き直すたびに最初の段へ戻す。
  useEffect(() => {
    if (open) {
      setDetent(initialDetent);
      setDragHeight(null);
    }
  }, [open, initialDetent]);

  const rootHeight = useCallback(() => rootRef.current?.clientHeight ?? 0, []);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const height = rootHeight();
      if (height === 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: (detents[detent] ?? detents[0] ?? 0.5) * height,
      };
    },
    [detent, detents, rootHeight],
  );

  const onHandlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dy) < DRAG_SLOP) return;
    setDragHeight(Math.max(0, drag.startHeight - dy));
  }, []);

  const onHandlePointerEnd = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      const height = rootHeight();
      const dy = event.clientY - drag.startY;
      setDragHeight(null);
      if (Math.abs(dy) < DRAG_SLOP || height === 0) return;

      const current = drag.startHeight - dy;
      const lowest = (detents[0] ?? 0.5) * height;
      // いちばん低い段からさらに引き下げたら閉じる。
      if (current < lowest - CLOSE_PULL) {
        onClose();
        return;
      }
      // 離した高さにいちばん近い段へ。
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      detents.forEach((fraction, index) => {
        const distance = Math.abs(fraction * height - current);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      setDetent(best);
    },
    [detents, onClose, rootHeight],
  );

  if (!open) return null;

  const fraction = detents[detent] ?? detents[0] ?? 0.5;
  const height = dragHeight === null ? `${fraction * 100}%` : `${dragHeight}px`;

  return (
    <div
      ref={rootRef}
      {...verifyAttrs({ unit: 'BottomSheet', detent, dragging: dragHeight !== null })}
      className="absolute inset-0 z-30 flex flex-col justify-end"
    >
      {/* 背景。押したら閉じる（シートの外は「戻る」）。 */}
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'color-mix(in srgb, var(--fg) 28%, transparent)' }}
      />

      <section
        role="dialog"
        aria-label={ariaLabel}
        className="relative flex flex-col overflow-hidden rounded-t-3xl"
        style={{
          height,
          maxHeight: '100%',
          background: 'var(--bg)',
          boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
          transition:
            dragHeight === null && !reduced
              ? 'height 260ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
        }}
      >
        {/* つまみと見出しの行。ここを引くと高さが変わる。 */}
        <div
          data-sheet-handle
          className="flex shrink-0 select-none flex-col items-center px-5 pt-2 pb-2"
          style={{ touchAction: 'none', cursor: 'grab' }}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerEnd}
          onPointerCancel={onHandlePointerEnd}
        >
          <span
            aria-hidden="true"
            className="mb-2 block h-1.5 w-9 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--fg) 18%, transparent)' }}
          />
          <div className="flex w-full items-center justify-between gap-3">
            <span
              className="text-[11px] uppercase tracking-[0.14em]"
              style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
            >
              {label ?? ''}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] shrink-0 rounded-full border px-4 text-[13px]"
              style={{ ...CONTROL_FONT, color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
            >
              {closeLabel}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-8">{children}</div>
      </section>
    </div>
  );
}
