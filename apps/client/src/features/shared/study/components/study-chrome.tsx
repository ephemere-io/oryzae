'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { StudyFermentationStatus } from '../types';

/** readiness がこれ以上なら「もうすぐ発酵します」に言い換える。 */
const ALMOST_THRESHOLD = 0.9;

export interface StudyChromeProps {
  status: StudyFermentationStatus;
  readiness: number;
  /** アバターに出す 1 文字。 */
  initial: string;
  avatarUrl?: string | null;
  /** SP は下端にナビがあるのでキャプションを出さない（64px のナビと競合する）。 */
  showCaption?: boolean;
}

/**
 * 書斎に浮かぶ最小限の UI（`docs/oryzae-study/00-overview.md`）。
 *
 * サイドバーが消えるかわりに、左上のブランドマークと左下のアバターだけが浮く。
 * 未読の数字バッジは出さない — 手紙が届いたことは**瓶の封**が伝える。
 */
export function StudyChrome({
  status,
  readiness,
  initial,
  avatarUrl,
  showCaption = true,
}: StudyChromeProps) {
  const t = useTranslations('study');
  const statusKey = resolveStatusKey(status, readiness);

  return (
    <div
      {...verifyAttrs({ unit: 'StudyChrome', status, statusKey, showCaption })}
      className="pointer-events-none absolute inset-0"
    >
      {/* 左上のブランドマーク。サブ画面では「BACK TO STUDY」を兼ねる（layout 側で出し分け）。 */}
      <div
        className="pointer-events-auto absolute left-6 top-6 flex h-10 w-10 items-center justify-center rounded-full"
        style={glass}
      >
        <span
          className="font-serif text-[13px] lowercase tracking-[0.08em]"
          style={{ color: '#8EA89C' }}
        >
          o
        </span>
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

      {showCaption && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 text-center">
          <div
            className="font-serif text-[13px] tracking-[0.28em]"
            style={{ color: '#5C4F3F', opacity: 0.75 }}
          >
            {t('title')}
          </div>
          <div
            className="mt-1 text-[9px] uppercase tracking-[0.24em]"
            style={{ color: '#8C857E', opacity: 0.7 }}
          >
            STUDY
          </div>
          <div className="mt-2 text-[11px]" style={{ color: '#5C4F3F', opacity: 0.6 }}>
            {t(statusKey)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 状態から文言を選ぶ。
 *
 * readiness は**数値では出さない**（％表記をしない）。「もうすぐ」だけが 0.9 を境に
 * 言い換わる（00-overview.md「コピー」）。
 */
export function resolveStatusKey(
  status: StudyFermentationStatus,
  readiness: number,
): 'status_idle' | 'status_fermenting' | 'status_almost' | 'status_completed' {
  if (status === 'completed') return 'status_completed';
  if (status === 'idle') return 'status_idle';
  return readiness >= ALMOST_THRESHOLD ? 'status_almost' : 'status_fermenting';
}

/** 浮かせる要素に共通の擦りガラス。 */
const glass: React.CSSProperties = {
  background: 'rgba(253, 251, 247, 0.72)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(122, 116, 64, 0.18)',
  boxShadow: '0 2px 12px rgba(140, 133, 126, 0.14)',
};
