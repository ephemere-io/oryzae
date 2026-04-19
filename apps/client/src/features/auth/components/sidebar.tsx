'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useTheme } from '@/lib/theme-context';
import { useUnread } from '@/lib/unread-context';

interface NavItem {
  href: string;
  label: string;
  match: string;
  iconPath: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/jar',
    label: 'Jar',
    match: '/jar',
    iconPath: 'M8 2h8v4H8zM6 6h12v2c0 5.5-2.5 8-6 12-3.5-4-6-6.5-6-12V6z',
  },
  {
    href: '/board',
    label: 'Board',
    match: '/board',
    iconPath:
      'M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5ZM14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5ZM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4ZM14 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Z',
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
];

export function Sidebar() {
  const pathname = usePathname();
  const { auth } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useUnread();

  return (
    <nav
      className="fixed left-0 top-0 bottom-0 z-30 flex w-20 flex-col items-center py-10 transition-all duration-500"
      style={{
        background: theme === 'dark' ? 'rgba(8, 8, 14, 0.8)' : 'rgba(253, 251, 247, 0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRight:
          theme === 'dark'
            ? '1px solid rgba(60, 70, 80, 0.1)'
            : '1px solid rgba(255, 255, 255, 0.6)',
        boxShadow: '4px 0 24px rgba(140, 133, 126, 0.02)',
      }}
    >
      {/* Vertical logo */}
      <div
        className="mb-14 text-[11px] font-serif uppercase tracking-[0.4em] opacity-80"
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          color: '#8EA89C',
        }}
      >
        Oryzae
      </div>

      {/* Nav items */}
      <div className="flex w-full flex-col items-center gap-8 px-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.match === '/entries' ? pathname === '/entries' : pathname.startsWith(item.match);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`group relative flex h-12 w-12 items-center justify-center rounded-[20px] transition-all duration-300 ${
                isActive
                  ? 'border text-[#8EA89C]'
                  : 'text-[#8C857E] hover:bg-[rgba(140,133,126,0.1)] hover:text-[#4A4541]'
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: 'rgba(142, 168, 156, 0.15)',
                      borderColor: 'rgba(142, 168, 156, 0.2)',
                      boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.8)',
                    }
                  : {}
              }
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`${isActive ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 transition-transform duration-300 group-hover:scale-110`}
              >
                <path d={item.iconPath} />
              </svg>
              {/* Active indicator dot */}
              {isActive && (
                <div
                  className="absolute -right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                  style={{
                    backgroundColor: '#8EA89C',
                    boxShadow: '0 0 6px #8EA89C',
                  }}
                />
              )}
              {/* Unread badge for Jar */}
              {item.match === '/jar' && unreadCount > 0 && (
                <span
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none text-white"
                  style={{
                    backgroundColor: '#D4714E',
                    boxShadow: '0 0 8px rgba(212, 113, 78, 0.5)',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Account avatar */}
      <Link
        href="/account"
        title="アカウント"
        className="group mb-2 flex h-12 w-12 items-center justify-center rounded-[20px] transition-all duration-300 hover:bg-[rgba(140,133,126,0.1)]"
      >
        {auth?.user.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: external avatar URL from OAuth
          <img
            src={auth.user.avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: auth ? 'var(--accent)' : '#ccc' }}
          >
            {auth?.user.nickname?.charAt(0).toUpperCase() ??
              auth?.user.email?.charAt(0).toUpperCase() ??
              '?'}
          </span>
        )}
      </Link>
    </nav>
  );
}
