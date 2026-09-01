'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { JAR_ICON_PATH } from '@/components/ui/icon-paths';
import { ICON_STROKE_WIDTH, SHELL_INSET, SHELL_ROW_HEIGHT } from '@/components/ui/surface';
import { useAuth } from '@/lib/auth-context';
import { docsHref } from '@/lib/docs-site';
import { useSidebarVisibility } from '@/lib/sidebar-context';
import { useUnread } from '@/lib/unread-context';

interface NavItem {
  href: string;
  /** sidebar.nav 以下の翻訳キー。 */
  labelKey: string;
  match: string;
  iconPath: string;
}

/**
 * 並び順は**しまう → 見る → 探す → 書く**。
 *
 * 先頭は瓶にする。このアプリで最初に目に入るべきものは、書いたものが納まっている場所
 * （手紙が届くのもここ）であって、ブランド名ではない。ロゴは名乗りであって行き先ではないので、
 * 行き先の列の先頭を占めない。
 */
const NAV_ITEMS: NavItem[] = [
  {
    href: '/jar',
    labelKey: 'jar',
    match: '/jar',
    // Issue #385: SP のナビ／CTA と形が違っていた（あちらは蓋の横棒＋下すぼまりでゴミ箱に
    // 見え、こちらは下がとがったフラスコ形）。同じ保存瓶の形に揃える。
    iconPath: JAR_ICON_PATH,
  },
  {
    href: '/board',
    labelKey: 'board',
    match: '/board',
    iconPath:
      'M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5ZM14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5ZM4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4ZM14 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4Z',
  },
  {
    href: '/entries',
    labelKey: 'list',
    match: '/entries',
    iconPath: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  },
  {
    href: '/entries/new',
    labelKey: 'editor',
    match: '/entries/new',
    iconPath:
      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  },
];

/**
 * PC のサイドバー。
 *
 * **畳んだ状態がアイコンだけ、開いた状態がアイコン + メニュー名**。その2つだけ。
 * 右の縁を押すか ⌘B で切り替わり、状態は localStorage に残る（`lib/sidebar-context`）。
 *
 * 上端の余白（20px）と行の高さ（48px）は `components/ui/surface` の SHELL_INSET /
 * SHELL_ROW_HEIGHT。**エントリー画面のヘッダーが同じ2つの数字を使う**ので、瓶と
 * 「問いを結ぶ」が同じ高さの線に乗る。下端の余白も同じ 20px にして、上下を釣り合わせる。
 */
export function Sidebar() {
  const t = useTranslations('sidebar');
  const pathname = usePathname();
  const { auth } = useAuth();
  const { unreadCount } = useUnread();
  const { hidden, collapsed, setCollapsed, width } = useSidebarVisibility();

  // ⌘B / Ctrl+B で開閉（shadcn のサイドバーと同じ）。道具はキーボードから届くのが速い。
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'b' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setCollapsed(!collapsed);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [collapsed, setCollapsed]);

  const accountLabel = auth?.user.nickname ?? auth?.user.email ?? t('nav.account');

  return (
    <nav
      {...verifyAttrs({ unit: 'Sidebar', pathname, collapsed, width })}
      className={`sidebar-sized fixed top-0 bottom-0 left-0 z-30 flex flex-col transition-opacity duration-300 ${
        hidden ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        paddingTop: SHELL_INSET,
        paddingBottom: SHELL_INSET,
        // 透けた白に頼っていたため、紙（--bg）とほぼ同じ明るさで境界が読めなかった。
        // ここは**書く紙ではない面**なので一段沈め、境界は線1本ではっきり引く
        // （影は境界を伝えるには弱すぎるので、線を主役にして影は添えるだけ）。
        background: 'var(--surface-sunken)',
        borderRight: '1px solid var(--surface-sunken-border)',
        boxShadow: '1px 0 3px rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* 行き先 */}
      <div className="flex flex-col gap-1 px-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.match === '/entries' ? pathname === '/entries' : pathname.startsWith(item.match);
          const label = t(`nav.${item.labelKey}`);
          return (
            <Link
              key={item.href}
              {...verifyAttrs({ navItem: item.match, active: isActive })}
              href={item.href}
              title={collapsed ? label : undefined}
              className={`group relative flex shrink-0 items-center gap-3 rounded-[16px] transition-colors duration-150 ${
                collapsed ? 'w-12 justify-center' : 'w-full px-3'
              } ${
                isActive
                  ? 'border text-[#8EA89C]'
                  : 'border border-transparent text-[var(--fg)] hover:bg-[var(--hover-wash)]'
              }`}
              style={{
                height: SHELL_ROW_HEIGHT,
                ...(isActive
                  ? {
                      backgroundColor: 'rgba(142, 168, 156, 0.15)',
                      borderColor: 'rgba(142, 168, 156, 0.2)',
                      boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.8)',
                    }
                  : {}),
              }}
            >
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={ICON_STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d={item.iconPath} />
                </svg>
                {/* 未読は瓶にだけ付く。アイコンに寄せて置く（行の右端に置くと、
                    畳んだときと開いたときで位置が飛ぶ）。 */}
                {item.match === '/jar' && unreadCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] leading-none font-bold text-white"
                    style={{
                      backgroundColor: '#D4714E',
                      boxShadow: '0 0 8px rgba(212, 113, 78, 0.5)',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="truncate text-[13px] whitespace-nowrap">{label}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* 行き先の列と、下の2行のあいだの空き。 */}
      <div className="flex-1" />

      {/* 使い方と、自分。どちらも「書く」ための行き先ではないので、下にまとめる。 */}
      <div className="flex flex-col gap-1 px-4">
        {/* 使い方は別ドメインの公開サイトにある（Issue #532 で切り出した）。
            アプリの外へ出るので Link ではなく素の <a> で、新しいタブに開く。 */}
        <a
          href={docsHref('/support')}
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? t('nav.help') : undefined}
          className={`group flex shrink-0 items-center gap-3 rounded-[16px] text-[var(--fg)] transition-colors duration-150 hover:bg-[var(--hover-wash)] ${
            collapsed ? 'w-12 justify-center' : 'w-full px-3'
          }`}
          style={{ height: SHELL_ROW_HEIGHT }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={ICON_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M9.4 9.4a2.6 2.6 0 0 1 4.6 1.6c0 1.7-2.4 2-2.4 3.4" />
              <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
            </svg>
          </span>
          {!collapsed && (
            <span className="truncate text-[13px] whitespace-nowrap">{t('nav.help')}</span>
          )}
        </a>

        <Link
          href="/account"
          title={collapsed ? t('nav.account') : undefined}
          className={`group flex shrink-0 items-center gap-3 rounded-[16px] transition-colors duration-150 hover:bg-[var(--hover-wash)] ${
            collapsed ? 'w-12 justify-center' : 'w-full px-3'
          }`}
          style={{ height: SHELL_ROW_HEIGHT }}
        >
          {auth?.user.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: external avatar URL from OAuth
            <img
              src={auth.user.avatarUrl}
              alt=""
              className="h-7 w-7 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: auth ? 'var(--accent)' : '#ccc' }}
            >
              {auth?.user.nickname?.charAt(0).toUpperCase() ??
                auth?.user.email?.charAt(0).toUpperCase() ??
                '?'}
            </span>
          )}
          {!collapsed && (
            <span className="truncate text-[13px] text-[var(--fg)] whitespace-nowrap">
              {accountLabel}
            </span>
          )}
        </Link>
      </div>

      {/* 右の縁。押せば開閉する。**掴んで幅を変える**のはやめた——中間の幅に意味が
          ある画面ではないうえ、掴めない・畳むと掴めない・本文が指に遅れる、と
          不具合が続いた。状態そのものを2つに減らす（shadcn のサイドバーと同じ）。 */}
      <button
        type="button"
        aria-label={collapsed ? t('expand') : t('collapse')}
        title={collapsed ? t('expand') : t('collapse')}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}
        // ポインタは**次に起きること**を指す（shadcn のサイドバーと同じ）。
        // 畳んでいれば右へ開くので e-resize、開いていれば左へ閉じるので w-resize。
        className={`absolute top-0 right-0 bottom-0 z-10 w-3 bg-transparent transition-colors after:absolute after:top-0 after:right-0 after:bottom-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-[var(--accent)] ${
          collapsed ? 'cursor-e-resize' : 'cursor-w-resize'
        }`}
      />
    </nav>
  );
}
