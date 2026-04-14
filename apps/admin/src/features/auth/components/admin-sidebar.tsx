'use client';

import {
  Activity,
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

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="flex w-56 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="text-[13px] text-muted-foreground">&#9670;</span>
        <span className="text-[13px] font-semibold tracking-wide text-foreground">Oryzae</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2.5 pt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                isActive
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border px-2.5 py-3">
        <div className="flex items-center justify-between gap-2 px-1">
          {auth && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {auth.user.email}
            </p>
          )}
          <div className="flex shrink-0 items-center gap-0.5">
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
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
