'use client';

import { verifyAttrs } from '@oryzae/verify';
import type { ReactNode } from 'react';
import { CONTROL_FONT } from '@/components/ui/surface';

/**
 * 「開いて選ぶ」面と、その中の1行。
 *
 * 設定パネルの Select、問いを結ぶチップ、この先に増える選択肢の面は、**どれも同じ材質・
 * 同じ行の高さ**でなければならない。同じ意味の操作が画面ごとに別の見た目になると、
 * 見るたびに読み直しが要る。ここを唯一の出どころにする。
 *
 * 面は `--surface-raised`（浮いた面のトークン）を使う。エディタの本文の上に出るものは
 * すべてこの面に乗る（アクションパレットと同じ材質）。
 */

/** 行の高さ。面の中の行はすべてこれ。 */
const MENU_ROW_HEIGHT_CLASS = 'h-8';

export function MenuPanel({
  id,
  role,
  ariaLabel,
  className = '',
  children,
}: {
  id?: string;
  /** listbox（単一選択）か menu（操作の集まり）か。 */
  role: 'listbox' | 'menu';
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  // role は静的な値で書く（変数にすると、その role でこの aria が使えるかを
  // 静的検査が判断できない）。共有するのは面の見た目だけ。
  const panelClass = `overflow-hidden overflow-y-auto rounded-lg border py-1 shadow-xl ${className}`;
  const panelStyle = {
    backgroundColor: 'var(--surface-raised)',
    borderColor: 'var(--surface-raised-border)',
    ...CONTROL_FONT,
  };

  const contract = verifyAttrs({ unit: 'MenuPanel', role, rowHeight: MENU_ROW_HEIGHT_CLASS });

  if (role === 'listbox') {
    return (
      <div
        id={id}
        role="listbox"
        aria-label={ariaLabel}
        className={panelClass}
        style={panelStyle}
        {...contract}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      id={id}
      role="menu"
      aria-label={ariaLabel}
      className={panelClass}
      style={panelStyle}
      {...contract}
    >
      {children}
    </div>
  );
}

/**
 * 面の中の1行。
 *
 * 左端に選択の印のための固定幅を必ず空ける（選ばれていない行も同じだけ空ける）。
 * ここが可変だと、選ぶたびに文字列が横に跳ねる。
 */
export function MenuOption({
  id,
  role,
  selected,
  active,
  tabIndex,
  onClick,
  onMouseEnter,
  children,
}: {
  /** aria-activedescendant で指し示すための id（キーボードを面の外で捌くとき）。 */
  id?: string;
  role: 'option' | 'menuitemcheckbox';
  selected: boolean;
  /** キーボードで今いる行（ホバーと同じ見え方にする）。 */
  active?: boolean;
  /**
   * -1 を渡すと Tab で行に入らなくなる。**面の外（器）でキーを捌く場合はこれを使う**
   * — 行にフォーカスが移ると、器の onKeyDown までイベントが上がってこないため。
   */
  tabIndex?: number;
  onClick: () => void;
  onMouseEnter?: () => void;
  children: ReactNode;
}) {
  const ariaProps =
    role === 'option' ? { 'aria-selected': selected } : { 'aria-checked': selected };
  return (
    <button
      id={id}
      type="button"
      role={role}
      {...ariaProps}
      tabIndex={tabIndex}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex ${MENU_ROW_HEIGHT_CLASS} w-full items-center gap-2 px-3 text-left text-[13px] transition-colors ${
        active ? 'bg-[var(--toolbar-hover)]' : 'hover:bg-[var(--hover-wash)]'
      }`}
      style={{ color: selected ? 'var(--accent)' : 'var(--fg)' }}
    >
      <span className="w-3 shrink-0" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
      <span className="truncate">{children}</span>
    </button>
  );
}
