'use client';

import {
  Activity,
  Bot,
  Bug,
  DollarSign,
  FlaskConical,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Moon,
  Plug,
  Sun,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from '@/lib/use-theme';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '../hooks/use-admin-auth';

/**
 * 監視は「何が壊れたか（Sentry）」と「どう使われているか（PostHog）」を分けて置く。
 * Tools は連携ツールの一覧（SSOT）で、監視の画面ではない。
 * 住み分けは docs/observability-guide.md。
 */
const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/users', label: 'Users', icon: Users },
      { href: '/questions', label: 'Questions', icon: HelpCircle },
      { href: '/fermentations', label: 'Fermentations', icon: FlaskConical },
      { href: '/costs', label: 'Costs', icon: DollarSign },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { href: '/errors', label: 'Errors', icon: Bug },
      { href: '/analytics', label: 'Analytics', icon: Activity },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/tools', label: 'Tools', icon: Plug },
      // 「勝手に回っているもの」の一覧。Tools の配下にあるが、
      // 探しに行くものではなく気づくべきものなので、サイドバーにも出す。
      { href: '/tools/automation', label: 'Automation', icon: Bot },
    ],
  },
];

/**
 * いま光らせる項目。いちばん長く一致したものを 1 つだけ選ぶ。
 * /tools/automation は Tools の配下でもあるので、前方一致だけだと 2 つ光る。
 */
function findActiveHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of NAV_SECTIONS.flatMap((s) => s.items)) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.length)) best = item.href;
  }
  return best;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);
  const router = useRouter();
  const { auth, logout } = useAdminAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="relative flex h-full shrink-0">
      <aside
        className={cn(
          'flex flex-col bg-sidebar transition-all duration-200',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-5 py-4 transition-colors hover:bg-sidebar-accent/50"
        >
          <span className="shrink-0 text-[13px] text-muted-foreground">&#9670;</span>
          {!collapsed && (
            <span className="text-[13px] font-semibold tracking-wide text-foreground">Oryzae</span>
          )}
        </Link>

        {/* Nav */}
        <nav className="flex-1 space-y-3 px-2.5 pt-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label ?? 'main'} className="space-y-0.5">
              {section.label &&
                (collapsed ? (
                  <div className="mx-2.5 my-1 border-t border-sidebar-border" />
                ) : (
                  <p className="px-2.5 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </p>
                ))}
              {section.items.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                      isActive
                        ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border px-2.5 py-3">
          <div
            className={cn(
              'flex items-center gap-2 px-1',
              collapsed ? 'flex-col' : 'justify-between',
            )}
          >
            {auth && !collapsed && (
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {auth.user.email}
              </p>
            )}
            <div className={cn('flex shrink-0 items-center gap-0.5', collapsed && 'flex-col')}>
              <button
                type="button"
                onClick={toggle}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="ログアウト"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Border handle — hover changes cursor, click toggles sidebar */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
        className="group absolute top-0 right-0 z-10 flex h-full w-2 translate-x-1/2 cursor-col-resize items-center justify-center"
      >
        {/* Visible border line */}
        <div className="h-full w-px bg-sidebar-border transition-colors group-hover:bg-primary" />
        {/* Chevron indicator on hover */}
        <div className="absolute flex h-6 w-4 items-center justify-center rounded-full bg-sidebar opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('h-3 w-3 text-primary', collapsed ? '' : 'rotate-180')}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </button>
    </div>
  );
}
