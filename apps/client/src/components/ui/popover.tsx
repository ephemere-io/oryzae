'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';

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

/**
 * トリガーの真下に開くパネル。
 *
 * 背景をグレーアウトするモーダルではなく、**外側をクリックすれば閉じる**軽いパネル。
 * 書いている最中に設定を触っても、本文が暗くならず作業が中断されない
 * （docs/entry-screen-design.md 原則1「本文を分断しない」の延長）。
 *
 * 位置決めはアンカーからの相対配置に閉じる（portal を使わない）。トリガーとパネルを
 * 同じ relative コンテナに入れるので、外側クリックの判定もこのコンテナ1つで済む。
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
  const panelId = useId();

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
          id={panelId}
          role="dialog"
          aria-label={ariaLabel}
          className={`absolute top-full z-[70] mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] shadow-xl ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
