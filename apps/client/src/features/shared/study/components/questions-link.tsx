'use client';

import { verifyAttrs } from '@oryzae/verify';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ELEVATED_CHIP_CLASS, ELEVATED_CHIP_STYLE } from '@/components/ui/surface';

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
 *
 * 面は書斎へ戻るタブ・問いのチップ・パレットと同じ（`ELEVATED_CHIP_*`。影は付けない）。
 * 以前は半透明の紙に擦りガラスと影で、同じ画面の部品と別の言葉になっていた。
 */
export function QuestionsLink() {
  const t = useTranslations('study');

  return (
    <Link
      href="/questions"
      {...verifyAttrs({ unit: 'QuestionsLink' })}
      className={`fixed right-6 top-6 z-[55] flex h-9 items-center gap-2 px-4 text-[12px] font-medium tracking-[0.08em] ${ELEVATED_CHIP_CLASS}`}
      style={ELEVATED_CHIP_STYLE}
    >
      {/* 問いが積み重なっていく形。3 本の横線を長さ違いで重ねる。 */}
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        // 色を持つのは印だけ（問いのチップの「◦」と同じ accent）。
        style={{ color: 'var(--accent)' }}
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
