'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SHELL_ROW_HEIGHT } from '@/components/ui/surface';

/**
 * 行き先を1つ表す行。
 *
 * **「いくつかの中から1つ選んで、そこへ移る」ものは、アプリの中で全部この形にする。**
 * 左のサイドバー（瓶・ボード・一覧・書く）と、発酵の面の中の切り替え（手紙・ことば・断片）は、
 * どちらも同じ「行き先の列」であって、別々の見た目で語られるべきものではない。
 * 以前は前者が角丸16pxの行、後者が薄い小さな見出しで、同じ役目に2つの語彙があった。
 *
 * ## 選ばれている行
 *
 * 地・枠・字の色は `--nav-active-*` の3本が持つ。行ごとに rgba を書かない
 * （dark で白い内側光が浮く、といった食い違いがそこから生まれていた）。
 *
 * ## 要素は行き先の種類で決まる
 *
 * - `href` あり … アプリ内の行き先。`<Link>`（中クリック・履歴が効く）
 * - `href` + `external` … アプリの外。素の `<a>` を新しいタブで
 * - `href` なし … 面の中の切り替え。`<button>`
 *
 * 見た目を1つにするために要素まで1つにすると、リンクの作法（中クリック・
 * ホバーで行き先が出る）を捨てることになるので、そこは分ける。
 */
export interface NavRowProps {
  /** 行の顔。寸法は呼ぶ側が決める（アイコンは 20px、アバターは 28px）。 */
  icon: ReactNode;
  label: string;
  /** いまここにいる／これを見ている。 */
  active?: boolean;
  /** アイコンだけにする（サイドバーを畳んだとき）。 */
  collapsed?: boolean;
  /** アイコンに寄り添う小さな印（未読の数など）。 */
  badge?: ReactNode;
  href?: string;
  /** アプリの外へ出る行き先。新しいタブで開く。 */
  external?: boolean;
  onClick?: () => void;
}

/** 行の高さ。サイドバーの項目とエントリー画面のヘッダー行が同じ線に乗るための数字。 */
const NAV_ROW_HEIGHT = SHELL_ROW_HEIGHT;

function rowClass(active: boolean, collapsed: boolean): string {
  return [
    'group relative flex shrink-0 items-center gap-3 rounded-[16px] border transition-colors duration-150',
    collapsed ? 'w-12 justify-center' : 'w-full px-3',
    active
      ? 'text-[var(--nav-active-fg)]'
      : 'border-transparent text-[var(--fg)] hover:bg-[var(--hover-wash)]',
  ].join(' ');
}

const ACTIVE_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--nav-active-bg)',
  borderColor: 'var(--nav-active-border)',
  boxShadow: 'inset 0 0 12px var(--nav-active-sheen)',
};

export function NavRow({
  icon,
  label,
  active = false,
  collapsed = false,
  badge,
  href,
  external = false,
  onClick,
}: NavRowProps) {
  const className = rowClass(active, collapsed);
  const style: React.CSSProperties = {
    height: NAV_ROW_HEIGHT,
    ...(active ? ACTIVE_STYLE : {}),
  };
  // 畳んでいるときは字が消えるので、名前はホバーでも読めるようにする。
  const title = collapsed ? label : undefined;
  // 行き先そのものを契約に出す。**どの行が選ばれているか**を外から確かめられるのは
  // 色ではなくこれ（面の中の切り替えは URL を持たないので空になる）。
  const contract = verifyAttrs({ unit: 'NavRow', active, collapsed, label, href: href ?? '' });

  const body = (
    <>
      <span className="relative flex shrink-0 items-center justify-center">
        {icon}
        {badge}
      </span>
      {!collapsed && <span className="truncate text-[13px] whitespace-nowrap">{label}</span>}
    </>
  );

  if (href && external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        aria-label={collapsed ? label : undefined}
        className={className}
        style={style}
        {...contract}
      >
        {body}
      </a>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        title={title}
        aria-label={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={className}
        style={style}
        {...contract}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={collapsed ? label : undefined}
      aria-pressed={active}
      className={className}
      style={style}
      {...contract}
    >
      {body}
    </button>
  );
}
