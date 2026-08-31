'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { JAR_ICON_PATH } from '@/components/ui/icon-paths';
import { ICON_STROKE_WIDTH, SHELL_INSET, SHELL_ROW_HEIGHT } from '@/components/ui/surface';
import { useAuth } from '@/lib/auth-context';
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, useSidebarVisibility } from '@/lib/sidebar-context';
import { useTheme } from '@/lib/theme-context';
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
 * **畳んだ状態がアイコンだけ、開いた状態がアイコン + メニュー名**。右端を掴めば幅を変えられ、
 * 縁のつまみを1回押せば畳める。幅と開閉は localStorage に残る（`lib/sidebar-context`）。
 *
 * 上端の余白（20px）と行の高さ（48px）は `components/ui/surface` の SHELL_INSET /
 * SHELL_ROW_HEIGHT。**エントリー画面のヘッダーが同じ2つの数字を使う**ので、瓶と
 * 「問いを結ぶ」が同じ高さの線に乗る。下端の余白も同じ 20px にして、上下を釣り合わせる。
 */
export function Sidebar() {
  const t = useTranslations('sidebar');
  const pathname = usePathname();
  const { auth } = useAuth();
  const { theme } = useTheme();
  const { unreadCount } = useUnread();
  const { hidden, collapsed, setCollapsed, expandedWidth, setExpandedWidth, width, restored } =
    useSidebarVisibility();
  const [dragging, setDragging] = useState(false);
  // ドラッグ中は state を書き換えず ref で追う（毎フレームの再描画を避ける）。
  const dragWidthRef = useRef(expandedWidth);
  // 掴んで動かしたあとに発火する click を食う。縁は「掴む」と「押す」を兼ねているので、
  // これが無いと幅を変えるたびに畳まれる。
  const draggedRef = useRef(false);

  const stopDrag = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (!dragging) return;
    function handleMove(e: PointerEvent) {
      draggedRef.current = true;
      const next = e.clientX;
      // 最小幅より内側まで引いたら畳む。ドラッグで閉じられるのが自然なので、
      // 「掴んで縮める」と「畳む」を別の操作にしない。
      if (next < SIDEBAR_MIN_WIDTH - 24) {
        setCollapsed(true);
        setDragging(false);
        return;
      }
      dragWidthRef.current = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, next));
      setCollapsed(false);
      setExpandedWidth(dragWidthRef.current);
    }
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', stopDrag);
    document.addEventListener('pointercancel', stopDrag);
    // ドラッグ中に本文が選択されるのを止める。
    const previousSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', stopDrag);
      document.removeEventListener('pointercancel', stopDrag);
      document.body.style.userSelect = previousSelect;
    };
  }, [dragging, setCollapsed, setExpandedWidth, stopDrag]);

  const accountLabel = auth?.user.nickname ?? auth?.user.email ?? t('nav.account');

  return (
    <nav
      {...verifyAttrs({ unit: 'Sidebar', pathname, collapsed, width })}
      className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col ${
        // 復元前は幅を動かさない（保存値へ飛ぶ瞬間が滑って見えるのを避ける）。
        restored && !dragging ? 'transition-[width,opacity] duration-300' : ''
      } ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{
        width,
        paddingTop: SHELL_INSET,
        paddingBottom: SHELL_INSET,
        background: theme === 'dark' ? 'rgba(8, 8, 14, 0.8)' : 'rgba(253, 251, 247, 0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRight:
          theme === 'dark'
            ? '1px solid rgba(60, 70, 80, 0.1)'
            : '1px solid rgba(255, 255, 255, 0.6)',
        boxShadow: '4px 0 24px rgba(140, 133, 126, 0.02)',
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
              className={`group relative flex shrink-0 items-center gap-3 rounded-[16px] transition-colors duration-300 ${
                collapsed ? 'w-12 justify-center' : 'w-full px-3'
              } ${
                isActive
                  ? 'border text-[#8EA89C]'
                  : 'border border-transparent text-[#8C857E] hover:bg-[rgba(140,133,126,0.1)] hover:text-[#4A4541]'
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
                  className="h-5 w-5 transition-transform duration-300 group-hover:scale-110"
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

      {/* 名乗り。行き先の列と、自分（アカウント）のあいだの空きに置く。
          畳んでいるときは縦組みで幅を食わない。 */}
      <div className="flex flex-1 items-center justify-center px-4">
        <span
          className="font-serif text-[11px] tracking-[0.4em] uppercase opacity-70"
          style={{
            color: '#8EA89C',
            ...(collapsed
              ? { writingMode: 'vertical-rl' as const, textOrientation: 'mixed' as const }
              : {}),
          }}
        >
          Oryzae
        </span>
      </div>

      {/* 自分 */}
      <div className="px-4">
        <Link
          href="/account"
          title={collapsed ? t('nav.account') : undefined}
          className={`group flex shrink-0 items-center gap-3 rounded-[16px] transition-colors duration-300 hover:bg-[rgba(140,133,126,0.1)] ${
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
            <span className="truncate text-[13px] text-[#8C857E] whitespace-nowrap">
              {accountLabel}
            </span>
          )}
        </Link>
      </div>

      {/* 右の縁。掴めば幅が変わり、押せば畳む／開く。
          shadcn のサイドバーと同じで、**縁そのものが操作子**（別の場所にボタンを置かない）。 */}
      <button
        type="button"
        aria-label={collapsed ? t('expand') : t('collapse')}
        title={collapsed ? t('expand') : t('collapse')}
        onClick={() => {
          // 直前が「掴んで動かした」なら、それは畳む操作ではない。
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          setCollapsed(!collapsed);
        }}
        onPointerDown={(e) => {
          // 開いているときだけ掴める（畳んだ状態から引き出すのは1クリックで足りる）。
          if (collapsed) return;
          e.preventDefault();
          draggedRef.current = false;
          setDragging(true);
        }}
        className={`absolute top-0 -right-1.5 bottom-0 z-10 w-3 cursor-col-resize bg-transparent transition-colors after:absolute after:top-0 after:bottom-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors ${
          dragging
            ? 'after:bg-[var(--accent)]'
            : 'after:bg-transparent hover:after:bg-[var(--accent)]'
        }`}
      />
    </nav>
  );
}
