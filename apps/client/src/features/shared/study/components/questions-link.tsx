'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * 瓶の画面から「問いの変遷」へ行く導線。
 *
 * **書斎がサイドバーを外したことで消えた道を、書斎が返す。** `/questions` は
 * サイドバーにしか入口が無く、書斎ホームでは「どこからも見られない」状態になっていた
 * （実機レビュー・PR #570）。問いの追加と編集は瓶の中でできるが、**いつ・どう変わって
 * きたか**（`QuestionTimeline`）はあの画面にしかない。
 *
 * 置き場が `features/shared/study/` なのは、この導線が存在する理由が書斎だから。
 * 瓶の画面そのもの（`JarView`）には触れない — 今回変えるのはナビゲーションと入口だけ、
 * という前提を守る。出し分けは `(protected)/layout.tsx` が行う。
 *
 * 上端の中央は「書斎へ戻る」のタブの席なので、こちらは右上に置く。
 */
export function QuestionsLink() {
  const t = useTranslations('study');

  return (
    <Link
      href="/questions"
      {...verifyAttrs({ unit: 'QuestionsLink' })}
      className="fixed right-6 top-6 z-[55] flex h-10 items-center gap-2 rounded-full px-4 text-[10px] uppercase tracking-[0.18em] transition-opacity duration-300 hover:opacity-80"
      style={{
        background: 'rgba(253, 251, 247, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(122, 116, 64, 0.18)',
        boxShadow: '0 2px 12px rgba(140, 133, 126, 0.14)',
        color: '#5C4F3F',
      }}
    >
      {/* 問いが積み重なっていく形。3 本の横線を長さ違いで重ねる。 */}
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        style={{ color: '#8EA89C' }}
      >
        <path
          d="M2 3.5H12M2 7H9M2 10.5H6"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
      {t('questions_timeline')}
    </Link>
  );
}
