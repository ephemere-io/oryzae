'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface UserAvatarProps {
  avatarUrl: string | null;
  name: string | null;
  email: string;
  expanded: boolean;
}

export function UserAvatar({ avatarUrl, name, email, expanded }: UserAvatarProps) {
  const pathname = usePathname();
  const isActive = pathname === '/account';
  const displayName = name ?? email.split('@')[0];
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <Link
      href="/account"
      title="アカウント"
      className={`flex items-center gap-3 transition-all ${
        isActive
          ? 'bg-[var(--accent-light)] text-[var(--accent)]'
          : 'text-[var(--date-color)] hover:bg-[var(--toolbar-hover)] hover:text-[var(--fg)]'
      } ${expanded ? 'mx-2 rounded-lg px-2.5 py-2' : 'self-center rounded-full px-2.5 py-1.5'}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-[18px] w-[18px] shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[8px] font-bold text-white">
          {initials}
        </span>
      )}
      {expanded && (
        <span
          className="truncate text-[11px] font-medium tracking-[0.08em]"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {displayName}
        </span>
      )}
    </Link>
  );
}
