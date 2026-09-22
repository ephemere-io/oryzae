'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { CONTROL_FONT, HOVER_CLASS } from '@/components/ui/surface';
import { HelpIllustration } from './help-illustrations';

/** 三歩。順番がそのままこのアプリの筋書き（問いを立てる → 書く → 漬けて待つ）。 */
const STEPS = [
  { id: 'question', illustration: 'question', href: '/jar' },
  { id: 'write', illustration: 'pen', href: '/entries/new' },
  { id: 'pickle', illustration: 'jar', href: '/jar' },
] as const;

export interface HelpFirstStepsProps {
  /** 押すと行き先へ。アプリの中の行き先だけ。 */
  onOpenHref: (href: string, external: boolean) => void;
}

/**
 * 「まず試してみよう」— このアプリの筋書きを三歩で見せる。
 *
 * 問いを立てる → エントリーを書く → 瓶に漬けて待つ。初めての人が面を開いて最初に目に
 * 入るのはこれ。話題の一覧の「はじめに」の 4 行を、読む物ではなく**辿る物**にした。
 * 三歩目には最初の手紙が届く条件（言語ごとの文字数）を添える — 何も起きない時間を
 * 「壊れている」と思わせないため。
 *
 * 番号はアクセントの丸。面の中で色を持つのはここと生きている 1 枚の線画だけ。
 */
export function HelpFirstSteps({ onOpenHref }: HelpFirstStepsProps) {
  const t = useTranslations('help.steps');

  return (
    <section
      {...verifyAttrs({ unit: 'HelpFirstSteps', stepCount: STEPS.length })}
      className="flex flex-col"
      style={CONTROL_FONT}
    >
      <h3 className="px-2.5 pb-1.5 text-[12px] font-medium tracking-[0.06em] text-[var(--fg)]">
        {t('title')}
      </h3>
      <ol className="flex flex-col">
        {STEPS.map((step, index) => (
          <li key={step.id} className="relative">
            {/* 歩と歩をつなぐ縦線。番号の丸の中心を通す。 */}
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute top-9 bottom-0 left-[1.4rem] w-px"
                style={{ background: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}
              />
            )}
            <button
              type="button"
              onClick={() => onOpenHref(step.href, false)}
              className={`flex w-full items-start gap-3 rounded-[10px] px-2.5 py-2 text-left ${HOVER_CLASS}`}
            >
              <span
                className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                <span className="text-[13px] text-[var(--fg)]">{t(`${step.id}.title`)}</span>
                <span className="text-[11px] leading-[1.6] text-[var(--date-color)]">
                  {t(`${step.id}.lead`)}
                </span>
              </span>
              <span className="mt-1 shrink-0 text-[var(--accent)]">
                <HelpIllustration kind={step.illustration} size={34} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
