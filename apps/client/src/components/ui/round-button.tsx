'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface RoundButtonProps {
  /** 読み上げに出す名前（中身はアイコンだけなので必須）。 */
  ariaLabel: string;
  /** あればリンク、無ければボタン。 */
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * 正円のボタン。44px の当たりに、一段沈んだ地の円。
 *
 * SP の上段の戻る・画面ごとの設定、一覧の閉じる・新規作成など、**画面の隅に置く 1 つの操作**は
 * すべてこれ（Notion のモバイルの上段と同じ骨格）。見た目を画面ごとに作らない。
 */
export function RoundButton({
  ariaLabel,
  href,
  onClick,
  children,
  className = '',
}: RoundButtonProps) {
  const cls = `flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:scale-95 ${className}`;
  const style = { background: 'var(--surface-sunken)', color: 'var(--fg)' } as const;
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

/** 上段の右端などに置く歯車。 */
export function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
