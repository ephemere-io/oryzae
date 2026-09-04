'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * サブ画面の左上に浮く「書斎へ戻る」マーク（`docs/oryzae-study/00-overview.md`）。
 *
 * 書斎ホームでは同じ位置にブランドマークが出る。サブ画面ではそれが戻る導線を兼ねる、
 * というのが仕様なので、**同じ大きさ・同じ位置**に置く。
 *
 * ここに置くことで jar / board / entry の各画面そのものには一切触らずに済む
 * （今回変えるのはナビゲーションと入口だけ、という前提を守る）。
 */
export function BackToStudy() {
  const t = useTranslations('study');

  return (
    <Link
      href="/study"
      {...verifyAttrs({ unit: 'BackToStudy' })}
      aria-label={t('back_to_study')}
      className="group fixed left-6 top-6 z-40 flex h-10 items-center gap-2 rounded-full px-3 transition-all duration-300"
      style={{
        background: 'rgba(253, 251, 247, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(122, 116, 64, 0.18)',
        boxShadow: '0 2px 12px rgba(140, 133, 126, 0.14)',
      }}
    >
      <span
        className="font-serif text-[13px] lowercase tracking-[0.08em]"
        style={{ color: '#8EA89C' }}
      >
        o
      </span>
      {/* 文字はホバーで開く。常時出すと画面の左上を占め続ける。 */}
      <span
        className="max-w-0 overflow-hidden whitespace-nowrap text-[9px] uppercase tracking-[0.2em] opacity-0 transition-all duration-300 group-hover:max-w-[140px] group-hover:opacity-100"
        style={{ color: '#5C4F3F' }}
      >
        {t('back_to_study')}
      </span>
    </Link>
  );
}
