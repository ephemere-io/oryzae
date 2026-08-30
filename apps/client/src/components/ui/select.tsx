'use client';

import { useEffect, useId, useRef, useState } from 'react';

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
        // listbox の器は <ul> ではなく <div>。<ul> には list という非対話の暗黙ロールがあり、
        // そこへ listbox を被せるのは不正（役割の上書きになる）。div は暗黙ロールを持たない。
        // 選択肢は <button role="option"> にして、クリックもキーボードもネイティブに任せる。
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-[75] mt-1 w-full overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] py-1 shadow-lg"
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(i)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex h-8 w-full items-center gap-2 px-2.5 text-left text-[13px] transition-colors ${
                  i === activeIndex ? 'bg-[var(--toolbar-hover)]' : ''
                }`}
                style={{ color: isSelected ? 'var(--accent)' : 'var(--fg)' }}
              >
                <span className="w-3 shrink-0" aria-hidden="true">
                  {isSelected ? '✓' : ''}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
