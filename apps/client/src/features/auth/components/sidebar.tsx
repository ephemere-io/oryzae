'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';

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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <nav className="flex h-full w-14 shrink-0 flex-col items-center gap-1.5 border-r border-[var(--border-subtle)] bg-[var(--bg)] px-0 py-4">
      {/* Logo */}
      <div
        className="mb-4 text-[9px] font-semibold tracking-[0.15em] text-[var(--accent)]"
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        ORYZAE
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.match === '/entries' ? pathname === '/entries' : pathname.startsWith(item.match);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`group relative flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
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
              className="h-[18px] w-[18px]"
            >
              <path d={item.iconPath} />
            </svg>
            <span
              className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] font-medium uppercase tracking-[0.12em] text-[var(--date-color)] opacity-0 transition-opacity group-hover:opacity-100"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      <button
        type="button"
        onClick={handleLogout}
        title="ログアウト"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--date-color)] transition-all hover:bg-[var(--toolbar-hover)] hover:text-[var(--accent)]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
      </button>
    </nav>
  );
}
