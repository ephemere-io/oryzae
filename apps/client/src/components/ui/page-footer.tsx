'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface FooterEntry {
  match: (pathname: string) => boolean;
  label: string;
}

/**
 * フッターを出さないルート。
 *
 * /board は Figma 風の下部中央ツールバー（BoardToolbar）が同じ帯を使う。ステータス表示の
 * ためだけの 36px を残すと道具箱が押し上げられ、キャンバスも削られるので出さない。
 */
const HIDDEN_PATHS = ['/board'];

function buildEntries(questionsLabel: string): FooterEntry[] {
  return [
    { match: (p) => p === '/jar', label: 'FERMENTING' },
    { match: (p) => p === '/entries/new' || p.startsWith('/entries/'), label: 'EDITOR' },
    { match: (p) => p === '/entries', label: 'LIST' },
    { match: (p) => p === '/questions', label: questionsLabel },
    { match: (p) => p === '/account', label: 'ACCOUNT' },
  ];
}

function resolveLabel(pathname: string, entries: FooterEntry[]): string {
  for (const entry of entries) {
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
  const t = useTranslations('footer.label');
  const entries = buildEntries(t('questions'));
  const label = resolveLabel(pathname, entries);

  if (HIDDEN_PATHS.includes(pathname)) return null;

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
