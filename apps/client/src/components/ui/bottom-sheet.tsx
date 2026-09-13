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
   * `'content'` は**中身の高さ**（上限 92%）。設定のように中身が短いシートは、これ 1 つにすると
   * 中身より大きく開かない（実機で、空白だらけのシートの空白を引いて再読み込みが起きていた）。
   */
  detents?: readonly Detent[];
  /** 最初に止まる段（`detents` の添字）。 */
  initialDetent?: number;
  children: React.ReactNode;
}

type Detent = number | 'content';

/** `'content'` の段の上限（親の高さに対する比）。 */
const CONTENT_MAX_FRACTION = 0.92;

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
  /** `'content'` の段の実測（親に対する比）。測れるまで null。 */
  const [contentFraction, setContentFraction] = useState<number | null>(null);
  /** 中身がスクロールするか。しないなら指の動きを中身に渡さない（文書へ連鎖して引っ張り更新になる）。 */
  const [contentScrollable, setContentScrollable] = useState(false);
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

  const hasContentDetent = detents.includes('content');
  const numericMax = detents.reduce<number>(
    (max, d) => (typeof d === 'number' ? Math.max(max, d) : max),
    0,
  );
  /** 段を比に解く。`'content'` は測った値（測れるまでは数値の段の最大か 0.5）。 */
  const resolved: readonly number[] = detents.map((d) =>
    typeof d === 'number' ? d : (contentFraction ?? (numericMax || 0.5)),
  );
  const maxFraction = Math.max(...resolved);
  const maxIndex = resolved.indexOf(maxFraction);
  /** シートの箱の高さを中身で決めるか（数値の段が無い、または content がいちばん高い）。 */
  const sizedByContent = hasContentDetent && numericMax <= (contentFraction ?? 0);

  // 中身の高さ（content の段）と、中身がスクロールするかを測る。開いている間だけ。
  useEffect(() => {
    if (!open || typeof ResizeObserver === 'undefined') return;
    const sheet = sheetRef.current;
    const content = contentRef.current;
    if (!sheet || !content) return;
    const measure = () => {
      const root = rootRef.current?.clientHeight ?? 0;
      if (hasContentDetent && root > 0) {
        // つまみの行 + 中身の自然な高さ。中身がスクロール容器なので scrollHeight が自然な高さ。
        const handle = sheet.querySelector<HTMLElement>('[data-sheet-handle]');
        const natural = (handle?.offsetHeight ?? 0) + content.scrollHeight;
        setContentFraction(Math.min(CONTENT_MAX_FRACTION, natural / root));
      }
      setContentScrollable(content.scrollHeight > content.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    for (const child of Array.from(content.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [open, hasContentDetent]);
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
        startOffset: offsetOf(resolved[detent] ?? resolved[0] ?? 0.5),
        active: false,
        fromContent: Boolean(target && contentRef.current?.contains(target)),
      };
    },
    [detent, resolved, offsetOf],
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
      const lowest = Math.min(...resolved);

      setDragging(false);

      // いちばん低い段からさらに引き下げたら閉じる。
      if (height > 0 && current * height < lowest * height - CLOSE_PULL) {
        onClose();
        return;
      }
      // 離した高さにいちばん近い段へ。
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      resolved.forEach((fraction, index) => {
        const distance = Math.abs(fraction - current);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      // 段へ収まる動きは transition に任せる。段が変わらないと React は style を書き直さない
      // ので、ここで自分で段の値を書く（書かないと離した位置に留まる）。
      sheet.style.transition = reduced ? 'none' : SNAP_TRANSITION;
      sheet.style.transform = percentTransform(resolved[best] ?? maxFraction);
      setDetent(best);
    },
    [resolved, maxFraction, onClose, percentTransform, reduced, rootHeight],
  );

  if (!open) return null;

  const fraction = resolved[detent] ?? resolved[0] ?? 0.5;
  // 引いている間は要素の style を直接書く（React は再描画しない）。content の段は測れるまで下に居る。
  const measured = !hasContentDetent || contentFraction !== null;
  const restingTransform =
    entered && measured ? percentTransform(fraction) : 'translate3d(0, 100%, 0)';

  return placeInSlot(
    <div
      ref={rootRef}
      {...verifyAttrs({
        unit: 'BottomSheet',
        detent,
        dragging,
        sizedByContent,
        contentScrollable,
      })}
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
          // 中身で決めるときは自然な高さ（上限つき）。数値の段があればいちばん高い段の高さ。
          ...(sizedByContent
            ? { height: 'auto', maxHeight: `${CONTENT_MAX_FRACTION * 100}%` }
            : { height: `${maxFraction * 100}%` }),
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

        {/* 中身。スクロールするときだけ pan-y（中で普通にスクロールできる）。しないときは none —
            pan-y のままだと指の動きが文書へ連鎖して Safari の引っ張り更新になる（実機）。 */}
        <div
          ref={contentRef}
          className="min-h-0 flex-1 overflow-auto px-6 pb-8"
          style={{
            touchAction: contentScrollable ? 'pan-y' : 'none',
            overscrollBehavior: 'contain',
          }}
        >
          {children}
        </div>
      </section>
    </div>,
    overlaySlot,
  );
}
