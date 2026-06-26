'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useUnread } from '@/lib/unread-context';

/**
 * SP シェルの最小ボトムナビ（Issue #363）。書く / 瓶 の2タブ。
 * 瓶には未読（届いた手紙）バッジを出す。device=sp の (protected) シェルでのみ使う。
 */
export function SpBottomNav() {
  const t = useTranslations('sp.nav');
  const pathname = usePathname();
  const { unreadCount } = useUnread();

  const tabs = [
    { href: '/entries/new', label: t('write'), active: pathname.startsWith('/entries'), badge: 0 },
    { href: '/jar', label: t('jar'), active: pathname.startsWith('/jar'), badge: unreadCount },
  ];

  return (
    <nav className="flex border-t border-[color-mix(in_srgb,var(--fg)_12%,transparent)] bg-[var(--bg)] text-[var(--fg)]">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`relative flex flex-1 items-center justify-center py-3 text-sm ${
            tab.active ? 'font-medium' : 'opacity-50'
          }`}
        >
          {tab.label}
          {tab.badge > 0 ? (
            <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[#a65b2e] px-1 text-[10px] text-white">
              {tab.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
