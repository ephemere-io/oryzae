'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StudyMark } from './study-mark';

export interface StudyChromeProps {
  /** アバターに出す 1 文字。 */
  initial: string;
  avatarUrl?: string | null;
}

/**
 * 書斎に浮かぶ最小限の UI（`docs/oryzae-study/00-overview.md`）。
 *
 * サイドバーが消えるかわりに、左上のマークと左下のアバターだけが浮く。
 *
 * **文字は置かない。** 以前は下端に部屋の名前と発酵の状態（「手紙が届いています」等）を
 * 出していたが、実機レビューで「特に書く必要もない、もう少しすっきりさせたい」と
 * 報告された。どちらも**物が既に語っている** — 部屋は見えているし、手紙が届いたことは
 * 瓶の封が伝える（未読の数字バッジを出さないのと同じ理由）。
 */
export function StudyChrome({ initial, avatarUrl }: StudyChromeProps) {
  const t = useTranslations('study');

  return (
    <div
      {...verifyAttrs({ unit: 'StudyChrome', hasAvatar: Boolean(avatarUrl) })}
      className="pointer-events-none absolute inset-0"
    >
      {/* 左上のマーク。サブ画面では同じ位置に「書斎へ戻る」が出る（layout 側で出し分け）。
          **同じ絵**にしてあるのは、戻り先が「さっきまで居たこの部屋」だと繋がるようにするため。
          以前は `o` の一文字で、実機レビューで「意味が分からない」と報告された。 */}
      <div
        className="pointer-events-auto absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-full"
        style={glass}
      >
        <StudyMark />
      </div>

      {/* 左下のアバター。サイドバーの下端にあったものがそのまま浮く。 */}
      <Link
        href="/account"
        aria-label={t('account')}
        className="pointer-events-auto absolute bottom-6 left-6 flex h-10 w-10 items-center justify-center rounded-full transition-opacity duration-300 hover:opacity-80"
        style={glass}
      >
        {avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: external avatar URL from OAuth
          <img
            src={avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {initial}
          </span>
        )}
      </Link>
    </div>
  );
}

/** 浮かせる要素に共通の擦りガラス。 */
const glass: React.CSSProperties = {
  background: 'rgba(253, 251, 247, 0.72)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(122, 116, 64, 0.18)',
  boxShadow: '0 2px 12px rgba(140, 133, 126, 0.14)',
};
