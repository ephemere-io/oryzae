'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '../hooks/use-admin-auth';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/costs', label: 'Cost Tracking' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAdminAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <aside className="flex w-56 flex-col border-r border-[var(--border)] bg-white">
      <div className="p-4 border-b border-[var(--border)]">
        <h2 className="text-lg font-semibold">Oryzae Admin</h2>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded px-3 py-2 text-sm ${
              pathname === item.href
                ? 'bg-[var(--accent-light)] text-[var(--accent)] font-medium'
                : 'text-[var(--muted)] hover:bg-gray-50'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded px-3 py-2 text-sm text-[var(--muted)] hover:bg-gray-50 text-left"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
