'use client';

import { useEffect, useRef, useState } from 'react';

interface EntryKebabMenuProps {
  onDeleteClick: () => void;
}

export function EntryKebabMenu({ onDeleteClick }: EntryKebabMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="メニューを開く"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--date-color)] transition-colors hover:bg-[rgba(200,180,140,0.08)] hover:text-[var(--fg)]"
      >
        <svg
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
          role="img"
        >
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[120px] overflow-hidden rounded-md border shadow-lg"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              onDeleteClick();
            }}
            className="block w-full px-4 py-2 text-left text-xs transition-colors hover:bg-[rgba(200,180,140,0.08)]"
            style={{ color: 'var(--fg)' }}
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}
