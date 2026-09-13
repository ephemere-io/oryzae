'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useCallback, useEffect, useRef, useState } from 'react';
import { placeInSlot, useSpChrome } from '@/lib/sp-chrome-context';
import { pickDetent, useSheetGesture } from './sheet-gesture';
import { CONTROL_FONT } from './surface';

type Detent = number | 'content';

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
   * `'content'` は**中身の高さ**（上限 92%）。中身が短いシートは、これ 1 つにすると中身より大きく開かない。
   */
  detents?: readonly Detent[];
  /** 最初に止まる段（`detents` の添字）。 */
  initialDetent?: number;
  children: React.ReactNode;
}

/** `'content'` の段の上限（親の高さに対する比）。 */
const CONTENT_MAX_FRACTION = 0.92;
/** いちばん低い段からこれ以上（px）引き下げたら閉じる。 */
const CLOSE_PULL = 80;
/** 段へ収まる動き。vaul（shadcn の Drawer）と同じ曲線。 */
const SNAP_TRANSITION = 'transform 420ms cubic-bezier(0.32, 0.72, 0, 1)';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 下から出る**モーダル**のシート。高さは段（detent）で止まり、つまみか中身を引いて段を変える。
 *
 * - 位置は **`transform` だけ**で動かす。シートの高さはいちばん高い段に固定し、下へずらして低い段を作る
 * - 指の動き（板 ⇄ 中身の受け渡し・慣性・縦横の確定）は `useSheetGesture`（`DockSheet` と共通）。
 *   板は `touch-action: none` で、中身のスクロールもこちらが書く（ブラウザに渡すと途中で取り返せない）
 * - 中身は `overscroll-behavior: contain`。端まで引いても外（ブラウザの引っ張り更新）へ伝えない
 * - いちばん低い段からさらに引き下げたら閉じる。離せば近い段へ収まる。速く払えばその向きの次の段
 * - 背景は暗転し、押せば閉じる。SP の殻の中なら殻の overlay の席に出る
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
  /** 開いた直後は画面の下に居て、次のフレームで段へ上がる（出てくる動き）。 */
  const [entered, setEntered] = useState(false);
  const [reduced, setReduced] = useState(false);
  /** `'content'` の段の実測（親に対する比）。測れるまで null。 */
  const [contentFraction, setContentFraction] = useState<number | null>(null);
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
  /** シートの箱の高さを中身で決めるか（数値の段が無い、または content がいちばん高い）。 */
  const sizedByContent = hasContentDetent && numericMax <= (contentFraction ?? 0);

  // 中身の高さ（content の段）を測る。開いている間だけ。
  useEffect(() => {
    if (!open || !hasContentDetent || typeof ResizeObserver === 'undefined') return;
    const sheet = sheetRef.current;
    const content = contentRef.current;
    if (!sheet || !content) return;
    const measure = () => {
      const root = rootRef.current?.clientHeight ?? 0;
      if (root <= 0) return;
      const handle = sheet.querySelector<HTMLElement>('[data-sheet-handle]');
      const natural = (handle?.offsetHeight ?? 0) + content.scrollHeight;
      setContentFraction(Math.min(CONTENT_MAX_FRACTION, natural / root));
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
  const heightOf = useCallback((fraction: number) => fraction * rootHeight(), [rootHeight]);

  const { handlers, dragging } = useSheetGesture({
    panelRef: sheetRef,
    contentRef,
    restingHeight: () => heightOf(resolved[detent] ?? resolved[0] ?? 0.5),
    minHeight: () => heightOf(Math.min(...resolved)),
    maxHeight: () => heightOf(maxFraction),
    dismissible: true,
    render: (visible) => {
      const sheet = sheetRef.current;
      if (sheet) sheet.style.transform = `translate3d(0, ${heightOf(maxFraction) - visible}px, 0)`;
    },
    onRelease: (visible, velocity) => {
      const sheet = sheetRef.current;
      const lowestIndex = resolved.indexOf(Math.min(...resolved));
      const lowestHeight = heightOf(Math.min(...resolved));
      // いちばん低い段からさらに引き下げたら、または低い段で速く払い下げたら閉じる。
      if (visible < lowestHeight - CLOSE_PULL || (velocity > 0.5 && detent === lowestIndex)) {
        onClose();
        return;
      }
      const best = pickDetent(
        resolved.map((f) => heightOf(f)),
        visible,
        velocity,
        detent,
      );
      // 段へ収まる動きは transition に任せる。段が変わらないと React は style を書き直さない
      // ので、ここで自分で段の値を書く（書かないと離した位置に留まる）。
      if (sheet) {
        sheet.style.transition = reduced ? 'none' : SNAP_TRANSITION;
        sheet.style.transform = percentTransform(resolved[best] ?? maxFraction);
      }
      setDetent(best);
    },
  });

  if (!open) return null;

  const fraction = resolved[detent] ?? resolved[0] ?? 0.5;
  // 引いている間は要素の style を直接書く（React は再描画しない）。content の段は測れるまで下に居る。
  const measured = !hasContentDetent || contentFraction !== null;
  const restingTransform =
    entered && measured ? percentTransform(fraction) : 'translate3d(0, 100%, 0)';

  return placeInSlot(
    <div
      ref={rootRef}
      {...verifyAttrs({ unit: 'BottomSheet', detent, dragging, sizedByContent })}
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
          // シートの中身は白い面（ベージュは紙の画面だけ。実機レビュー）。
          background: 'var(--surface-raised)',
          boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
          transform: restingTransform,
          transition: reduced || dragging ? 'none' : SNAP_TRANSITION,
          willChange: 'transform',
          // 指の動きは全部こちらで受ける（中身のスクロールも）。
          touchAction: 'none',
        }}
        {...handlers}
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

        {/* 中身。スクロールはこちらが書く（指）かブラウザ（ホイール）。端で外へ伝えない。 */}
        <div
          ref={contentRef}
          className="min-h-0 flex-1 overflow-auto px-6 pb-8"
          style={{ overscrollBehavior: 'contain' }}
        >
          {children}
        </div>
      </section>
    </div>,
    overlaySlot,
  );
}
