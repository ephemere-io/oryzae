'use client';

import {
  Activity,
  BarChart3,
  DollarSign,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '../hooks/use-admin-auth';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/fermentations', label: 'Fermentations', icon: FlaskConical },
  { href: '/costs', label: 'Costs', icon: DollarSign },
  { href: '/analytics', label: 'Analytics', icon: Activity },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { auth, logout } = useAdminAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center gap-2 px-6 py-5">
        <BarChart3 className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-wide">Oryzae Admin</span>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="px-3 py-4 space-y-2">
        {auth && <p className="truncate px-3 text-xs text-muted-foreground">{auth.user.email}</p>}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
