'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { MenuOption, MenuPanel } from '@/components/ui/menu';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  /** トリガーの幅（Tailwind クラス）。 */
  className?: string;
  /** 値が未選択のときにトリガーへ出す文字列。 */
  placeholder?: string;
}

/**
 * ネイティブ `<select>` の置き換え。
 *
 * OS 依存の見た目（macOS / Windows / iOS で全く別物になる）を排し、エディタの
 * 余白・書体・配色に合わせた見た目に揃えるための最小限のリストボックス。
 * ライブラリを足さずに済む範囲で、キーボード操作（↑↓ / Enter / Escape / Home / End）を持たせる。
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  className = 'w-full',
  placeholder,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(activeIndex);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        className="flex h-7 w-full items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] bg-transparent px-2.5 text-left text-[13px] text-[var(--fg)] transition-colors hover:bg-[var(--toolbar-hover)]"
      >
        <span className="truncate">{selected ? selected.label : (placeholder ?? '')}</span>
        <svg
          aria-hidden="true"
          className="h-3 w-3 shrink-0 opacity-60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        // 面と行は MenuPanel / MenuOption（components/ui/menu）が持つ。問いを結ぶチップの
        // ドロップダウンと**同じ部品**なので、同じ材質・同じ行の高さで開く。
        <div className="absolute z-[75] mt-1 w-full">
          <MenuPanel id={listId} role="listbox" ariaLabel={ariaLabel}>
            {options.map((option, i) => (
              <MenuOption
                key={option.value}
                role="option"
                selected={option.value === value}
                active={i === activeIndex}
                onClick={() => commit(i)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {option.label}
              </MenuOption>
            ))}
          </MenuPanel>
        </div>
      )}
    </div>
  );
}
