'use client';

import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  DollarSign,
  Eye,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTheme } from '@/lib/use-theme';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '../hooks/use-admin-auth';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/fermentations', label: 'Fermentations', icon: FlaskConical },
  { href: '/costs', label: 'Costs', icon: DollarSign },
  { href: '/analytics', label: 'Analytics', icon: Activity },
  { href: '/observability', label: 'Observability', icon: Eye },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth, logout } = useAdminAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
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
      <nav className="flex-1 space-y-0.5 px-2.5 pt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border px-2.5 py-3">
        <div
          className={cn('flex items-center gap-2 px-1', collapsed ? 'flex-col' : 'justify-between')}
        >
          {auth && !collapsed && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {auth.user.email}
            </p>
          )}
          <div className={cn('flex shrink-0 items-center gap-0.5', collapsed && 'flex-col')}>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              title={collapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
            >
              {collapsed ? (
                <ChevronsRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronsLeft className="h-3.5 w-3.5" />
              )}
            </button>
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
  );
}
