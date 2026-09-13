'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useCallback, useEffect, useRef, useState } from 'react';
import { placeInSlot, useSpChrome } from '@/lib/sp-chrome-context';
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

/** いちばん低い段からこれ以上（px）引き下げたら閉じる。 */
const CLOSE_PULL = 80;

/** これ未満の動きは押したとみなす（px）。 */
const DRAG_SLOP = 4;

/** 段へ収まる動き。vaul（shadcn の Drawer）と同じ曲線。 */
const SNAP_TRANSITION = 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1)';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Drag {
  pointerId: number;
  startY: number;
  /** 掴んだ時点の、いちばん高い段からの下がり（px）。 */
  startOffset: number;
  /** スロップを越えて本当に引き始めたか。 */
  active: boolean;
  /** 中身（スクロールする領域）の上で掴んだか。 */
  fromContent: boolean;
}

/**
 * 下から出るシート。高さは段（detent）で止まり、つまみか中身を引いて段を変える。
 *
 * ### 動かし方（vaul / iOS のシートと同じ）
 *
 * - 位置は **`transform` だけ**で動かす。以前は引いている間 `height` を毎フレーム書き換えて
 *   いて、レイアウトが走ってカクついた。シートの高さはいちばん高い段に固定し、下へ
 *   ずらして低い段を作る。引いている間は React を通さず要素の style を直接書く
 * - シート自体は `touch-action: none`（指の動きはこちらが受ける）。中身のスクロール領域は
 *   スクロール容器なので、その中では `pan-y` が効いて普通にスクロールできる
 * - 中身の上で引いたとき: 中身が先頭（`scrollTop === 0`）で下へ引けばシートを下げ、
 *   いちばん高い段でなければ上へ引いてシートを上げる。それ以外は中身に任せる
 * - 中身は `overscroll-behavior: contain`。端まで引いても外（ブラウザの引っ張り更新）へ
 *   伝えない。ブラウザの更新が走っていたのはこれが無かったため
 * - いちばん低い段からさらに引き下げたら閉じる。離せば近い段へ収まる
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
  const sheetRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [detent, setDetent] = useState(initialDetent);
  const [dragging, setDragging] = useState(false);
  /** 開いた直後は画面の下に居て、次のフレームで段へ上がる（出てくる動き）。 */
  const [entered, setEntered] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const [reduced, setReduced] = useState(false);
  // SP の殻の中なら、殻の箱に重ねる（本文が伸びる画面で内容の末尾に出ないように）。
  const { overlaySlot } = useSpChrome();

  useEffect(() => setReduced(prefersReducedMotion()), []);

  // 開き直すたびに最初の段へ戻し、下から出てくる。
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setDetent(initialDetent);
    setDragging(false);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open, initialDetent]);

  const maxFraction = Math.max(...detents);
  const maxIndex = detents.indexOf(maxFraction);
  /** 段の位置。自身の高さに対する % なので、親の採寸を待たずに描ける。 */
  const percentTransform = useCallback(
    (fraction: number) =>
      `translate3d(0, ${(((maxFraction - fraction) / maxFraction) * 100).toFixed(3)}%, 0)`,
    [maxFraction],
  );
  const rootHeight = useCallback(() => rootRef.current?.clientHeight ?? 0, []);
  /** 段 → いちばん高い段からの下がり（px）。 */
  const offsetOf = useCallback(
    (fraction: number) => (maxFraction - fraction) * rootHeight(),
    [maxFraction, rootHeight],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const target = event.target instanceof Node ? event.target : null;
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startOffset: offsetOf(detents[detent] ?? detents[0] ?? 0.5),
        active: false,
        fromContent: Boolean(target && contentRef.current?.contains(target)),
      };
    },
    [detent, detents, offsetOf],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const sheet = sheetRef.current;
      if (!drag || !sheet || drag.pointerId !== event.pointerId) return;
      const dy = event.clientY - drag.startY;

      if (!drag.active) {
        if (Math.abs(dy) < DRAG_SLOP) return;
        if (drag.fromContent) {
          const content = contentRef.current;
          const atTop = !content || content.scrollTop <= 0;
          // 中身に任せる: 先頭でないのに下へ、いちばん高い段で上へ。
          if ((dy > 0 && !atTop) || (dy < 0 && detent === maxIndex)) {
            dragRef.current = null;
            return;
          }
        }
        drag.active = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // 既に離れた指や合成イベントでは NotFoundError になる。掴めなくても動きは追える。
        }
        sheet.style.transition = 'none';
        setDragging(true);
      }

      const next = Math.min(Math.max(drag.startOffset + dy, 0), rootHeight());
      sheet.style.transform = `translate3d(0, ${next}px, 0)`;
    },
    [detent, maxIndex, rootHeight],
  );

  const onPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const sheet = sheetRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (!drag.active || !sheet) return;

      const height = rootHeight();
      const offset = Math.min(
        Math.max(drag.startOffset + (event.clientY - drag.startY), 0),
        height,
      );
      const current = height > 0 ? maxFraction - offset / height : maxFraction;
      const lowest = Math.min(...detents);

      setDragging(false);

      // いちばん低い段からさらに引き下げたら閉じる。
      if (height > 0 && current * height < lowest * height - CLOSE_PULL) {
        onClose();
        return;
      }
      // 離した高さにいちばん近い段へ。
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      detents.forEach((fraction, index) => {
        const distance = Math.abs(fraction - current);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      // 段へ収まる動きは transition に任せる。段が変わらないと React は style を書き直さない
      // ので、ここで自分で段の値を書く（書かないと離した位置に留まる）。
      sheet.style.transition = reduced ? 'none' : SNAP_TRANSITION;
      sheet.style.transform = percentTransform(detents[best] ?? maxFraction);
      setDetent(best);
    },
    [detents, maxFraction, onClose, percentTransform, reduced, rootHeight],
  );

  if (!open) return null;

  const fraction = detents[detent] ?? detents[0] ?? 0.5;
  // 引いている間は要素の style を直接書く（React は再描画しない）。
  const restingTransform = entered ? percentTransform(fraction) : 'translate3d(0, 100%, 0)';

  return placeInSlot(
    <div
      ref={rootRef}
      {...verifyAttrs({ unit: 'BottomSheet', detent, dragging })}
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col justify-end overflow-hidden"
    >
      {/* 背景。押したら閉じる（シートの外は「戻る」）。 */}
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0"
        style={{
          background: 'color-mix(in srgb, var(--fg) 28%, transparent)',
          opacity: entered ? 1 : 0,
          transition: reduced ? 'none' : 'opacity 260ms ease-out',
        }}
      />

      <section
        ref={sheetRef}
        role="dialog"
        aria-label={ariaLabel}
        className="relative flex flex-col overflow-hidden rounded-t-3xl"
        style={{
          height: `${maxFraction * 100}%`,
          background: 'var(--bg)',
          boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
          transform: restingTransform,
          transition: reduced || dragging ? 'none' : SNAP_TRANSITION,
          willChange: 'transform',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* つまみと見出しの行。 */}
        <div
          data-sheet-handle
          className="flex shrink-0 select-none flex-col items-center px-5 pt-2 pb-2"
          style={{ cursor: 'grab' }}
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

        {/* 中身。スクロール容器なので、この中では pan-y が効く。端で外へ伝えない。 */}
        <div
          ref={contentRef}
          className="min-h-0 flex-1 overflow-auto px-6 pb-8"
          style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
        >
          {children}
        </div>
      </section>
    </div>,
    overlaySlot,
  );
}
