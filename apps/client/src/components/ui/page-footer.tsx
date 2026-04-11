'use client';

import { usePathname } from 'next/navigation';

interface FooterEntry {
  match: (pathname: string) => boolean;
  label: string;
}

const FOOTER_ENTRIES: FooterEntry[] = [
  { match: (p) => p === '/board', label: 'BOARD' },
  { match: (p) => p === '/jar', label: 'FERMENTING' },
  { match: (p) => p === '/entries/new' || p.startsWith('/entries/'), label: 'EDITOR' },
  { match: (p) => p === '/entries', label: 'LIST' },
  { match: (p) => p === '/questions', label: '問い一覧' },
];

function resolveLabel(pathname: string): string {
  for (const entry of FOOTER_ENTRIES) {
    if (entry.match(pathname)) return entry.label;
  }
  return 'ORYZAE';
}

/**
 * Global footer (UI_SPEC.md §3).
 * - Height: 36px
 * - Status display only — no clickable actions
 * - Label is derived from the current pathname
 */
export function PageFooter() {
  const pathname = usePathname();
  const label = resolveLabel(pathname);

  return (
    <footer
      className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--footer-bg)] px-4 text-xs text-[var(--date-color)]"
      style={{ fontFamily: 'Inter, "Noto Sans JP", sans-serif' }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--date-color)] opacity-30" />
        <span className="tracking-[0.15em]">{label}</span>
      </div>

      {/* Center: progress bar (decorative) */}
      <div className="flex justify-center">
        <div className="h-0.5 w-16 overflow-hidden rounded-full bg-[var(--item-border)]">
          <div className="h-full w-0 rounded-full bg-[var(--accent)]" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="tracking-[0.15em]">{label}</span>
      </div>
    </footer>
  );
}
