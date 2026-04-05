'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { COLLAPSED_WIDTH, EXPANDED_WIDTH, SidebarContext } from '@/lib/sidebar-context';

interface NavItem {
  href: string;
  label: string;
  match: string;
  iconPath: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/entries',
    label: 'List',
    match: '/entries',
    iconPath: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  },
  {
    href: '/entries/new',
    label: 'Editor',
    match: '/entries/new',
    iconPath:
      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  },
  {
    href: '/questions',
    label: '問い一覧',
    match: '/questions',
    iconPath:
      'M12 5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M12 19m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M12 6.5v4M12 13.5v4',
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  // Keyboard shortcut: Cmd+B / Ctrl+B
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const width = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <SidebarContext.Provider value={{ expanded, toggle }}>
      <nav
        data-state={expanded ? 'expanded' : 'collapsed'}
        className="group flex h-full shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg)] py-4 transition-[width] duration-200 ease-linear"
        style={{ width }}
      >
        {/* Logo + toggle */}
        <button
          type="button"
          onClick={toggle}
          className="mb-4 flex items-center justify-center self-center"
          title={expanded ? 'サイドバーを閉じる (⌘B)' : 'サイドバーを開く (⌘B)'}
        >
          {expanded ? (
            <span
              className="text-xs font-semibold tracking-[0.2em] text-[var(--accent)]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              ORYZAE
            </span>
          ) : (
            <span
              className="text-[9px] font-semibold tracking-[0.15em] text-[var(--accent)]"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              ORYZAE
            </span>
          )}
        </button>

        {/* Nav items */}
        <div className="flex flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.match === '/entries' ? pathname === '/entries' : pathname.startsWith(item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all ${
                  isActive
                    ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                    : 'text-[var(--date-color)] hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]'
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[18px] w-[18px] shrink-0"
                >
                  <path d={item.iconPath} />
                </svg>
                {expanded && (
                  <span
                    className="truncate text-[11px] font-medium uppercase tracking-[0.08em]"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          title="ログアウト"
          className={`flex items-center gap-3 self-center rounded-full px-2.5 py-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--accent)] ${expanded ? 'self-stretch mx-2 rounded-lg' : ''}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px] shrink-0"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {expanded && (
            <span
              className="text-[11px] font-medium uppercase tracking-[0.08em]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              ログアウト
            </span>
          )}
        </button>
      </nav>
    </SidebarContext.Provider>
  );
}
