'use client';

import { verifyAttrs } from '@oryzae/verify';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { placeInSlot, useSpChrome } from '@/lib/sp-chrome-context';
import { pickDetent, useSheetGesture } from './sheet-gesture';

export type DockDetent = 'peek' | 'half' | 'full';

export interface DockSheetProps {
  /** 出ているか。false なら何も描かない。 */
  open: boolean;
  detent: DockDetent;
  onDetentChange: (detent: DockDetent) => void;
  ariaLabel: string;
  /** 使う段（低い順）。既定は 3 段。設定のように 1 段だけのシートもある。 */
  detents?: readonly DockDetent[];
  /**
   * 段の高さ。`peek` は px、`half` / `full` は使える高さ（殻から上段と下端の列を除いた高さ）に対する比。
   * `half: 'content'` は中身の自然な高さ（上限は使える高さ）。
   */
  heights?: { peek?: number; half?: number | 'content'; full?: number };
  /** いちばん低い段からさらに引き下げたら閉じる。 */
  dismissible?: boolean;
  onClose?: () => void;
  /** いちばん低い段（覗く）に出す 1 行。無ければつまみだけ。 */
  peek?: ReactNode;
  /** 覗く段を押したとき（呼び出し側がフォーカスを外してから半分へ上げる、等）。 */
  onPeekTap?: () => void;
  /** 半分・全画面で出す中身（スクロールする）。 */
  children: ReactNode;
}

/** 段へ収まる動き。`BottomSheet` と同じ曲線。 */
const SNAP_TRANSITION = 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)';
const HEIGHT_TRANSITION = 'height 320ms cubic-bezier(0.32, 0.72, 0, 1)';
const DEFAULT_PEEK = 56;
const DEFAULT_HALF = 0.5;
const DEFAULT_FULL = 1;
/** いちばん低い段からこれ以上（px）引き下げたら閉じる（閉じられる板）。 */
const CLOSE_PULL = 72;
const ALL_DETENTS: readonly DockDetent[] = ['peek', 'half', 'full'];

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 本文の下に居座る**非モーダル**のシート（Google マップの「場所」のシートと同じ骨格）。
 *
 * `BottomSheet` との違い:
 * - 暗転しない。本文は触れる。**本文を押しても閉じない**
 * - 既定では消えない。いちばん低い段から下へ引いても止まる（`dismissible` なら閉じる）
 * - **流れの中に居る。** 殻の `dockSlot`（本文と下端の列の間）へ portal し、止まっている段の高さぶん
 *   本文（`main`）が縮む。だから本文の末尾の行がシートの下に隠れず、下端の列も必ず見えている
 *   （段の高さは**使える高さ**＝殻から上段と列を除いた高さから決める。殻の高さから決めると、
 *   全画面の段で列が殻の外へ押し出されてブラウザのバーの下に潜った）
 * - 引いている間だけ transform で動かし（レイアウトを走らせない）、離したら高さを段に合わせる
 *
 * 指の動き（段の受け渡し・慣性・縦横の確定）は `useSheetGesture`（`BottomSheet` と共通）。
 */
export function DockSheet({
  open,
  detent,
  onDetentChange,
  ariaLabel,
  detents = ALL_DETENTS,
  heights,
  dismissible = false,
  onClose,
  peek,
  onPeekTap,
  children,
}: DockSheetProps) {
  const { dockSlot } = useSpChrome();
  const outerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [reduced, setReduced] = useState(false);
  /** 使える高さ（殻から上段・列を除いた分）。測れるまで 0。 */
  const [available, setAvailable] = useState(0);
  /** 中身の自然な高さ（`half: 'content'` のとき）。 */
  const [contentHeight, setContentHeight] = useState(0);
  const peekHeight = heights?.peek ?? DEFAULT_PEEK;
  const halfSpec = heights?.half ?? DEFAULT_HALF;
  const fullFraction = heights?.full ?? DEFAULT_FULL;

  useEffect(() => setReduced(prefersReducedMotion()), []);

  // 使える高さを測る: 殻の高さから、本文とこの席以外の兄弟（上段・下端の列）を引く。
  // 殻の外（孤立検証）では親の高さ。キーボードで殻が縮めば測り直す。
  useEffect(() => {
    if (!open || typeof ResizeObserver === 'undefined') return;
    const outer = outerRef.current;
    const slot = outer?.parentElement;
    const shell = slot?.parentElement;
    if (!outer || !slot || !shell) return;
    const inShell = slot.hasAttribute('data-sp-dock-slot');
    const measure = () => {
      if (!inShell) {
        setAvailable(slot.clientHeight);
        return;
      }
      let taken = 0;
      for (const child of Array.from(shell.children)) {
        if (child === slot || child.tagName === 'MAIN') continue;
        if (child.hasAttribute('data-sp-overlay-slot')) continue;
        if (child instanceof HTMLElement) taken += child.offsetHeight;
      }
      setAvailable(Math.max(0, shell.clientHeight - taken));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inShell ? shell : slot);
    if (inShell) {
      for (const child of Array.from(shell.children)) {
        if (child !== slot && child.tagName !== 'MAIN') observer.observe(child);
      }
    }
    return () => observer.disconnect();
  }, [open]);

  // 中身の自然な高さ（つまみの行 + 中身）。`half: 'content'` のときだけ要る。
  useEffect(() => {
    if (!open || halfSpec !== 'content' || typeof ResizeObserver === 'undefined') return;
    const content = contentRef.current;
    const panel = panelRef.current;
    if (!content || !panel) return;
    const measure = () => {
      const handle = panel.querySelector<HTMLElement>('[data-dock-peek]');
      setContentHeight((handle?.offsetHeight ?? 0) + content.scrollHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    for (const child of Array.from(content.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [open, halfSpec]);

  const heightOf = useCallback(
    (which: DockDetent): number => {
      if (which === 'peek') return peekHeight;
      if (available === 0) return peekHeight;
      if (which === 'half') {
        const half = halfSpec === 'content' ? contentHeight : Math.round(available * halfSpec);
        return Math.min(Math.max(peekHeight, half), available);
      }
      return Math.max(peekHeight, Math.round(available * fullFraction));
    },
    [available, contentHeight, peekHeight, halfSpec, fullFraction],
  );
  const detentHeights = detents.map(heightOf);
  const lowest = detents[0] ?? 'peek';
  const highest = detents[detents.length - 1] ?? 'full';
  const maxHeight = heightOf(highest);
  const restingHeight = heightOf(detent);
  const measured = available > 0 && (halfSpec !== 'content' || contentHeight > 0);

  const render = useCallback(
    (visible: number) => {
      const panel = panelRef.current;
      if (panel) panel.style.transform = `translate3d(0, ${maxHeight - visible}px, 0)`;
    },
    [maxHeight],
  );

  const { handlers, dragging, movedRef } = useSheetGesture({
    panelRef,
    contentRef,
    restingHeight: () => restingHeight,
    minHeight: () => heightOf(lowest),
    maxHeight: () => maxHeight,
    dismissible,
    render,
    onRelease: (visible, velocity) => {
      const panel = panelRef.current;
      const lowestHeight = heightOf(lowest);
      if (
        dismissible &&
        onClose &&
        (visible < lowestHeight - CLOSE_PULL || (velocity > 0.5 && detent === lowest))
      ) {
        onClose();
        return;
      }
      const from = Math.max(0, detents.indexOf(detent));
      const best = pickDetent(detentHeights, visible, velocity, from);
      const next = detents[best] ?? lowest;
      if (panel) {
        panel.style.transition = reduced ? 'none' : SNAP_TRANSITION;
        panel.style.transform = `translate3d(0, ${maxHeight - heightOf(next)}px, 0)`;
      }
      if (next !== detent) onDetentChange(next);
    },
  });

  if (!open) return null;

  return placeInSlot(
    <div
      ref={outerRef}
      {...verifyAttrs({ unit: 'DockSheet', detent, dragging, measured })}
      // 流れの中の箱。止まっている段の高さを持ち、本文（main）をその分縮める。
      // 板（section）は箱の下端に揃えた最大の高さで、下へずらして低い段を作る。箱の下端より下に
      // はみ出た分（下端の列に重なる）は clip-path で切る。上（本文の上）へは引き上げられる。
      className="relative z-20 shrink-0"
      style={{
        height: measured ? restingHeight : peekHeight,
        transition: reduced ? 'none' : HEIGHT_TRANSITION,
        clipPath: 'inset(-100vh 0 0 0)',
      }}
    >
      <section
        ref={panelRef}
        aria-label={ariaLabel}
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-3xl border-t"
        style={{
          height: maxHeight,
          background: 'var(--surface-raised)',
          borderColor: 'var(--surface-raised-border)',
          boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
          transform: `translate3d(0, ${maxHeight - (measured ? restingHeight : peekHeight)}px, 0)`,
          transition: reduced || dragging ? 'none' : SNAP_TRANSITION,
          willChange: 'transform',
          // 指の動きは全部こちらで受ける（中身のスクロールも）。ブラウザに渡すと途中で取り返せない。
          touchAction: 'none',
        }}
        {...handlers}
      >
        {/* つまみと、覗く段の 1 行。押すと段を切り替える（動かしていなければ）。 */}
        <button
          type="button"
          data-dock-peek
          onClick={() => {
            if (movedRef.current) return;
            if (detents.length < 2) return;
            if (detent === lowest) {
              onPeekTap?.();
              onDetentChange(detents[1] ?? lowest);
            } else {
              onDetentChange(lowest);
            }
          }}
          aria-expanded={detent !== lowest}
          aria-label={peek ? undefined : ariaLabel}
          className="flex w-full shrink-0 select-none flex-col items-center px-5 pt-2 text-left"
          style={{ minHeight: peek ? peekHeight : undefined, cursor: 'grab' }}
        >
          <span
            aria-hidden="true"
            className="mb-2 block h-1.5 w-9 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--fg) 18%, transparent)' }}
          />
          {peek ? <span className="flex w-full min-w-0 items-center">{peek}</span> : null}
        </button>

        <div
          ref={contentRef}
          data-dock-content
          className="min-h-0 flex-1 overflow-auto px-5 pb-6"
          style={{ overscrollBehavior: 'contain' }}
        >
          {children}
        </div>
      </section>
    </div>,
    dockSlot,
  );
}
