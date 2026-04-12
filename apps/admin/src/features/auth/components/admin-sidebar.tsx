'use client';

import { Activity, DollarSign, FlaskConical, LayoutDashboard, LogOut, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
    <aside className="flex w-56 flex-col border-r border-[#1f1f24] bg-[#09090b]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="text-[13px] text-[#71717a]">&#9670;</span>
        <span className="text-[13px] font-semibold tracking-wide text-[#ececef]">Oryzae</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2.5 pt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                isActive
                  ? 'bg-white/5 font-medium text-white'
                  : 'text-[#71717a] hover:bg-white/[0.03] hover:text-[#a1a1aa]',
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-[#1f1f24] px-2.5 py-3">
        <div className="flex items-center justify-between gap-2 px-1">
          {auth && (
            <p className="truncate font-mono text-[11px] text-[#52525b]">{auth.user.email}</p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-md p-1 text-[#52525b] transition-colors hover:bg-white/[0.03] hover:text-[#a1a1aa]"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
