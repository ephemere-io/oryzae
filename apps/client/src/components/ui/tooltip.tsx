'use client';

import { useId, useState } from 'react';

interface HelpTooltipProps {
  /** ツールチップに出す説明文。 */
  content: string;
  /** トリガーの読み上げ名（「〜の説明」）。 */
  ariaLabel: string;
}

/**
 * 「?」アイコンにぶら下がる説明ツールチップ。
 *
 * 長い説明文をパネルに常時置くと、設定が読みにくくなり縦にも伸びる。説明は畳んで、
 * 必要な人だけが開けるようにする。ホバーだけでなく**フォーカスでも開く**ので
 * キーボードからも読める。
 */
export function HelpTooltip({ content, ariaLabel }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-subtle)] text-[10px] leading-none text-[var(--date-color)] transition-colors hover:border-[var(--fg)] hover:text-[var(--fg)]"
      >
        ?
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-[80] mb-1.5 w-56 -translate-x-1/2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] px-2.5 py-2 text-[11px] leading-relaxed text-[var(--fg)] shadow-lg"
        >
          {content}
        </span>
      )}
    </span>
  );
}
