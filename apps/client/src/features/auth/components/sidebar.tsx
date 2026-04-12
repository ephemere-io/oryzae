'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { COLLAPSED_WIDTH, EXPANDED_WIDTH, useSidebar } from '@/lib/sidebar-context';
import { useTheme } from '@/lib/theme-context';

interface NavItem {
  href: string;
  label: string;
  match: string;
  iconPath: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/board',
    label: 'Board',
    match: '/board',
    iconPath:
      'M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5ZM14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5ZM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4ZM14 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Z',
  },
  {
    href: '/jar',
    label: 'Jar',
    match: '/jar',
    iconPath: 'M8 2h8v4H8zM6 6h12v2c0 5.5-2.5 8-6 12-3.5-4-6-6.5-6-12V6z',
  },
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { expanded, toggle } = useSidebar();
  const { theme, toggle: toggleTheme } = useTheme();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const width = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <div className="relative flex h-full shrink-0" style={{ width }}>
      <nav
        data-state={expanded ? 'expanded' : 'collapsed'}
        className="flex h-full w-full flex-col bg-[var(--bg)] py-4 transition-[width] duration-200 ease-linear"
      >
        {/* Logo */}
        <div className="mb-4 flex items-center justify-center">
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
        </div>

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

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'light' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'}
          className={`mb-1 flex items-center gap-3 self-center rounded-full px-2.5 py-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--accent)] ${expanded ? 'mx-2 self-stretch rounded-lg' : ''}`}
        >
          {theme === 'light' ? (
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
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
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
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
          {expanded && (
            <span
              className="text-[11px] font-medium uppercase tracking-[0.08em]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {theme === 'light' ? 'Dark' : 'Light'}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          title="ログアウト"
          className={`flex items-center gap-3 self-center rounded-full px-2.5 py-1.5 text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--accent)] ${expanded ? 'mx-2 self-stretch rounded-lg' : ''}`}
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

      {/* Border handle — click to toggle, hover shows chevron cursor */}
      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? 'サイドバーを閉じる' : 'サイドバーを開く'}
        className="group/handle absolute top-0 right-0 z-10 flex h-full w-2 translate-x-1/2 cursor-col-resize items-center justify-center"
      >
        {/* Visible border line */}
        <div className="h-full w-px bg-[var(--border-subtle)] transition-colors group-hover/handle:bg-[var(--accent)]" />
        {/* Chevron indicator on hover */}
        <div className="absolute flex h-6 w-4 items-center justify-center rounded-full bg-[var(--bg)] opacity-0 shadow-sm transition-opacity group-hover/handle:opacity-100">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3 w-3 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </button>
    </div>
  );
}
