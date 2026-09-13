'use client';

import { verifyAttrs } from '@oryzae/verify';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { placeInSlot, useSpChrome } from '@/lib/sp-chrome-context';

export type DockDetent = 'peek' | 'half' | 'full';

export interface DockSheetProps {
  /** 出ているか。false なら何も描かない。 */
  open: boolean;
  detent: DockDetent;
  onDetentChange: (detent: DockDetent) => void;
  ariaLabel: string;
  /**
   * いちばん低い段（覗く）に出す 1 行。常に見えている。押すと半分に上がる（`onPeekTap`）。
   */
  peek: ReactNode;
  /** 覗く段を押したとき（呼び出し側がフォーカスを外してから半分へ上げる、等）。 */
  onPeekTap?: () => void;
  /** 半分・全画面で出す中身（スクロールする）。 */
  children: ReactNode;
  /** 覗く段の高さ（px）。 */
  peekHeight?: number;
  /** 半分・全画面の高さ（親＝殻の高さに対する比）。 */
  fractions?: { half: number; full: number };
}

/** 段へ収まる動き。`BottomSheet` と同じ曲線。 */
const SNAP_TRANSITION = 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)';
const HEIGHT_TRANSITION = 'height 320ms cubic-bezier(0.32, 0.72, 0, 1)';
const DRAG_SLOP = 4;
const DEFAULT_PEEK = 56;
const DEFAULT_FRACTIONS = { half: 0.45, full: 0.88 } as const;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Drag {
  pointerId: number;
  startY: number;
  /** 掴んだ時点の見えている高さ（px）。 */
  startHeight: number;
  active: boolean;
  fromContent: boolean;
  /** 動いたか（動いていなければ押した＝覗く段のタップ）。 */
  moved: boolean;
}

/**
 * 本文の下に居座る**非モーダル**のシート（Google マップの「場所」のシートと同じ骨格）。
 *
 * `BottomSheet` との違い:
 * - 暗転しない。本文は触れる。**本文を押しても閉じない**
 * - 消えない。いちばん低い段（覗く: 1 行）から下へ引いても覗く段で止まる。消すのは呼び出し側
 *   （パレットの操作）
 * - **流れの中に居る。** 殻の `dockSlot`（本文と下端の列の間）へ portal し、止まっている段の高さぶん
 *   本文（`main`）が縮む。だから本文の末尾の行がシートの下に隠れない（キャレットを見せるスクロールも
 *   本文の箱の中で正しく効く）。引いている間だけは transform で動かし（レイアウトを走らせない）、
 *   離したら高さを段に合わせる
 *
 * 「見ながら書く」のために: 書いている間（キーボードが出ている間）は呼び出し側が覗く段に固定し、
 * 覗く段を押せばフォーカスを外して半分へ（読む）、本文を押せばまた覗く段へ（書く）。
 */
export function DockSheet({
  open,
  detent,
  onDetentChange,
  ariaLabel,
  peek,
  onPeekTap,
  children,
  peekHeight = DEFAULT_PEEK,
  fractions = DEFAULT_FRACTIONS,
}: DockSheetProps) {
  const { dockSlot } = useSpChrome();
  const outerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  /** 直前の指が引いたか。引いたあとの click（覗く段のボタン）を押したと数えないため。 */
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [contentScrollable, setContentScrollable] = useState(false);
  /** 殻（親）の高さ。段を px にするのに使う。測れるまで 0（覗く段だけで描く）。 */
  const [parentHeight, setParentHeight] = useState(0);

  useEffect(() => setReduced(prefersReducedMotion()), []);

  // 親（殻）の高さを測る。キーボードで殻が縮めば段の px も変わる。
  useEffect(() => {
    if (!open || typeof ResizeObserver === 'undefined') return;
    const outer = outerRef.current;
    const parent = outer?.parentElement?.parentElement; // slot → 殻
    if (!parent) return;
    const measure = () => setParentHeight(parent.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [open]);

  // 中身がスクロールするか（しないなら指の動きを中身に渡さない＝文書へ連鎖させない）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 段が変わると中身の見える高さが変わるので測り直す
  useEffect(() => {
    if (!open || typeof ResizeObserver === 'undefined') return;
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setContentScrollable(content.scrollHeight > content.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [open, detent]);

  const heightOf = useCallback(
    (which: DockDetent): number => {
      if (which === 'peek' || parentHeight === 0) return peekHeight;
      return Math.max(peekHeight, Math.round(parentHeight * fractions[which]));
    },
    [parentHeight, peekHeight, fractions],
  );
  const fullHeight = heightOf('full');
  const restingHeight = heightOf(detent);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      const target = event.target instanceof Node ? event.target : null;
      movedRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: restingHeight,
        active: false,
        fromContent: Boolean(target && contentRef.current?.contains(target)),
        moved: false,
      };
    },
    [restingHeight],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const panel = panelRef.current;
      if (!drag || !panel || drag.pointerId !== event.pointerId) return;
      const dy = event.clientY - drag.startY;
      if (!drag.active) {
        if (Math.abs(dy) < DRAG_SLOP) return;
        if (drag.fromContent) {
          const content = contentRef.current;
          const atTop = !content || content.scrollTop <= 0;
          // 中身に任せる: 先頭でないのに下へ、全画面で上へ。
          if ((dy > 0 && !atTop) || (dy < 0 && detent === 'full')) {
            dragRef.current = null;
            return;
          }
        }
        drag.active = true;
        drag.moved = true;
        movedRef.current = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // 既に離れた指や合成イベントでは NotFoundError になる。掴めなくても動きは追える。
        }
        panel.style.transition = 'none';
        setDragging(true);
      }
      const visible = Math.min(Math.max(drag.startHeight - dy, peekHeight), fullHeight);
      panel.style.transform = `translate3d(0, ${fullHeight - visible}px, 0)`;
    },
    [detent, fullHeight, peekHeight],
  );

  const onPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const panel = panelRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (!drag.active || !panel) return;
      setDragging(false);

      const visible = Math.min(
        Math.max(drag.startHeight - (event.clientY - drag.startY), peekHeight),
        fullHeight,
      );
      // 離した高さにいちばん近い段へ。
      const candidates: DockDetent[] = ['peek', 'half', 'full'];
      let best: DockDetent = 'peek';
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of candidates) {
        const distance = Math.abs(heightOf(candidate) - visible);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
      panel.style.transition = reduced ? 'none' : SNAP_TRANSITION;
      panel.style.transform = `translate3d(0, ${fullHeight - heightOf(best)}px, 0)`;
      if (best !== detent) onDetentChange(best);
    },
    [detent, fullHeight, heightOf, onDetentChange, peekHeight, reduced],
  );

  if (!open) return null;

  return placeInSlot(
    <div
      ref={outerRef}
      {...verifyAttrs({ unit: 'DockSheet', detent, dragging, contentScrollable })}
      // 流れの中の箱。止まっている段の高さを持ち、本文（main）をその分縮める。
      // 板（section）は箱の下端に揃えた全画面の高さで、下へずらして低い段を作る。箱の下端より下に
      // はみ出た分（下端の列に重なる）は clip-path で切る。上（本文の上）へは引き上げられる。
      className="relative z-20 shrink-0"
      style={{
        height: restingHeight,
        transition: reduced ? 'none' : HEIGHT_TRANSITION,
        clipPath: 'inset(-100vh 0 0 0)',
      }}
    >
      <section
        ref={panelRef}
        aria-label={ariaLabel}
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl border-t"
        style={{
          height: fullHeight,
          background: 'var(--surface-raised)',
          borderColor: 'var(--surface-raised-border)',
          boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
          transform: `translate3d(0, ${fullHeight - restingHeight}px, 0)`,
          transition: reduced || dragging ? 'none' : SNAP_TRANSITION,
          willChange: 'transform',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* 覗く段。つまみ + 1 行。押すと半分へ（動かしていなければ）。 */}
        <button
          type="button"
          data-dock-peek
          onClick={() => {
            if (movedRef.current) return;
            if (detent === 'peek') {
              onPeekTap?.();
              onDetentChange('half');
            } else {
              onDetentChange('peek');
            }
          }}
          aria-expanded={detent !== 'peek'}
          className="flex w-full shrink-0 select-none flex-col items-center px-5 pt-2 text-left"
          style={{ height: peekHeight, cursor: 'grab' }}
        >
          <span
            aria-hidden="true"
            className="mb-2 block h-1.5 w-9 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--fg) 18%, transparent)' }}
          />
          <span className="flex w-full min-w-0 items-center">{peek}</span>
        </button>

        <div
          ref={contentRef}
          data-dock-content
          className="min-h-0 flex-1 overflow-auto px-5 pb-6"
          style={{
            touchAction: contentScrollable ? 'pan-y' : 'none',
            overscrollBehavior: 'contain',
          }}
        >
          {children}
        </div>
      </section>
    </div>,
    dockSlot,
  );
}
