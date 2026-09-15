'use client';

import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { LAYER } from './surface';

interface PopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** トリガー。`aria-expanded` と `aria-haspopup` はここで面倒を見る。 */
  trigger: (props: {
    'aria-expanded': boolean;
    'aria-haspopup': 'dialog';
    'aria-controls': string;
    onClick: () => void;
  }) => ReactNode;
  children: ReactNode;
  /** アンカーに対する寄せ。既定は右寄せ（トリガーが画面右上にあるため）。 */
  align?: 'left' | 'right';
  /** パネルの幅（Tailwind クラス）。 */
  panelClassName?: string;
  ariaLabel: string;
}

/** パネルの下端を、窓の下端から離しておく距離。 */
const VIEWPORT_MARGIN = 16;
/** 窓がどれだけ低くても確保する高さ。数行は見えないと、面として読めない。 */
const MIN_PANEL_HEIGHT = 160;

/**
 * トリガーの真下に開くパネル。
 *
 * 背景をグレーアウトするモーダルではなく、**外側をクリックすれば閉じる**軽いパネル。
 * 書いている最中に設定を触っても、本文が暗くならず作業が中断されない
 * （docs/entry-screen-design.md 原則1「本文を分断しない」の延長）。
 *
 * 位置決めはアンカーからの相対配置に閉じる（portal を使わない）。トリガーとパネルを
 * 同じ relative コンテナに入れるので、外側クリックの判定もこのコンテナ1つで済む。
 *
 * ## 重なり
 *
 * パネルは**浮いているパレットより手前**に出す（surface の `LAYER`）。パレットは動かせるので
 * パネルの上に来ることがあり、以前はそのときパネルの下半分が塞がれて、スクロールも
 * 一番下の操作（「このエントリーを消す」）も届かなかった。
 *
 * ## 高さ
 *
 * **窓に残っている分だけ**使い、越える分はパネルの中でスクロールする。以前は 70vh 固定で、
 * 背の高い窓でも下の3割を空けたまま中身が切れていた（Mac はスクロールバーを隠すので、
 * 続きがあることも分からない）。ヘッダーの高さを足し引きせず、開いた位置から測る。
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'right',
  panelClassName = 'w-80',
  ariaLabel,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) onOpenChange(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open) return;
    // `fit` という名前は Biome がテストの `fit`（focused test）と取り違える。
    function fitToWindow() {
      const panel = panelRef.current;
      if (!panel) return;
      const top = panel.getBoundingClientRect().top;
      setMaxHeight(Math.max(MIN_PANEL_HEIGHT, window.innerHeight - top - VIEWPORT_MARGIN));
    }
    fitToWindow();
    // 全画面の出入りも resize として届く。
    window.addEventListener('resize', fitToWindow);
    return () => window.removeEventListener('resize', fitToWindow);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({
        'aria-expanded': open,
        'aria-haspopup': 'dialog',
        'aria-controls': panelId,
        onClick: () => onOpenChange(!open),
      })}
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={ariaLabel}
          // overscroll-contain: 端まで来ても、後ろの本文をスクロールさせない。
          className={`absolute top-full mt-2 overflow-y-auto overscroll-contain rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClassName}`}
          style={{ zIndex: LAYER.popover, maxHeight: maxHeight ?? '70vh' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
