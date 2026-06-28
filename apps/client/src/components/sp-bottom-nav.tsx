'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useUnread } from '@/lib/unread-context';

/** 一覧アイコン（横線）。 */
function ListIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <title>list</title>
      <path d="M4 5h16M4 10h16M4 15h10" strokeLinecap="round" />
    </svg>
  );
}

/** 瓶アイコン。 */
function JarIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <title>jar</title>
      <path
        d="M9 3h6M8 7h8l-.6 11a2 2 0 0 1-2 1.9H10.6a2 2 0 0 1-2-1.9L8 7Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * SP シェルのボトムナビ（Issue #363）。指摘「メニューが機械的すぎる」への対応で
 * 均等なテキスト4タブをやめ、左右2タブ（エントリー / 瓶）＋中央に「書く」を昇格した
 * FAB、という片手で押しやすい構成にした。アカウントは各画面のアバターから開く。
 * device=sp の (protected) シェルでのみ使う。
 */
export function SpBottomNav() {
  const t = useTranslations('sp.nav');
  const pathname = usePathname();
  const { unreadCount } = useUnread();

  const onList = pathname === '/entries';
  const onJar = pathname.startsWith('/jar');

  return (
    <nav
      className="relative flex flex-none items-center justify-around px-2"
      style={{
        height: 64,
        borderTop: '1px solid var(--border-subtle)',
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        backdropFilter: 'blur(10px)',
        fontFamily: 'var(--ob-font-sans)',
      }}
    >
      <Link
        href="/entries"
        className="flex w-16 flex-col items-center gap-0.5 text-[10px]"
        style={{ color: onList ? 'var(--accent)' : 'var(--date-color)' }}
        aria-current={onList ? 'page' : undefined}
      >
        <ListIcon />
        {t('list')}
      </Link>

      <Link
        href="/entries/new"
        aria-label={t('write')}
        className="flex flex-none items-center justify-center text-white"
        style={{
          width: 52,
          height: 52,
          marginTop: -22,
          borderRadius: 18,
          background: 'var(--ob-jar-warm)',
          boxShadow: '0 8px 20px -6px color-mix(in srgb, var(--ob-jar-warm) 55%, transparent)',
          border: '3px solid var(--bg)',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <title>write</title>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </Link>

      <Link
        href="/jar"
        className="relative flex w-16 flex-col items-center gap-0.5 text-[10px]"
        style={{ color: onJar ? 'var(--accent)' : 'var(--date-color)' }}
        aria-current={onJar ? 'page' : undefined}
      >
        <JarIcon />
        {t('jar')}
        {unreadCount > 0 ? (
          <span
            className="absolute flex items-center justify-center text-[9px] font-bold text-white"
            style={{
              top: -3,
              right: 8,
              minWidth: 15,
              height: 15,
              padding: '0 3px',
              borderRadius: 8,
              background: 'var(--ob-jar-warm)',
            }}
          >
            {unreadCount}
          </span>
        ) : null}
      </Link>
    </nav>
  );
}
