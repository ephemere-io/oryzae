'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { CONTROL_FONT, HOVER_CLASS } from '@/components/ui/surface';
import { HELP_STEPS } from '../tutorial';
import type { HelpProgress, HelpStepId } from '../types';
import { HelpIllustration } from './help-illustrations';

/** 歩ごとの線画と行き先。順は `HELP_STEPS`。 */
const STEP_VIEW: Record<HelpStepId, { illustration: 'question' | 'pen' | 'jar'; href: string }> = {
  question: { illustration: 'question', href: '/jar' },
  write: { illustration: 'pen', href: '/entries/new' },
  pickle: { illustration: 'jar', href: '/jar' },
};

export interface HelpFirstStepsProps {
  /** 押すと行き先へ。アプリの中の行き先だけ。 */
  onOpenHref: (href: string, external: boolean) => void;
  /** 済んだ歩。null なら分からない（全部を同じ濃さで出す）。 */
  progress?: HelpProgress | null;
  /** いまの歩。番号が脈打ち、画面の中の相手も同じ脈で灯る。 */
  current?: HelpStepId | null;
}

type StepState = 'plain' | 'done' | 'current' | 'upcoming';

function stateOf(
  step: HelpStepId,
  progress: HelpProgress | null,
  current: HelpStepId | null,
): StepState {
  if (!progress) return 'plain';
  if (progress[step]) return 'done';
  if (step === current) return 'current';
  return 'upcoming';
}

/**
 * 「まず試してみよう」— このアプリの筋書きを三歩で見せる。
 *
 * 問いを立てる → エントリーを書く → 瓶に漬けて待つ。初めての人が面を開いて最初に目に
 * 入るのはこれ。話題の一覧の「はじめに」の 4 行を、読む物ではなく**辿る物**にした。
 * 三歩目には最初の手紙が届く条件（言語ごとの文字数）を添える — 何も起きない時間を
 * 「壊れている」と思わせないため。
 *
 * 一個ずつ済ませていく。済んだ歩は番号が印になり、いまの歩は番号が脈打つ（画面の中の
 * 相手 — 「問いを追加する」のボタンなど — も同じ脈で灯る。`docs/help-mode-guide.md`）。
 * まだの歩は薄い。進み具合はサーバーの旗（問いがある・結んだ・漬けた）そのもので、
 * ここでは憶えない。
 *
 * 番号はアクセントの丸。面の中で色を持つのはここと生きている 1 枚の線画だけ。
 */
export function HelpFirstSteps({
  onOpenHref,
  progress = null,
  current = null,
}: HelpFirstStepsProps) {
  const t = useTranslations('help.steps');
  const doneList = HELP_STEPS.filter((step) => progress?.[step]).join(',');

  return (
    <section
      {...verifyAttrs({
        unit: 'HelpFirstSteps',
        stepCount: HELP_STEPS.length,
        current: current ?? 'none',
        done: doneList === '' ? 'none' : doneList,
      })}
      className="flex flex-col"
      style={CONTROL_FONT}
    >
      <h3 className="px-2.5 pb-1.5 text-[12px] font-medium tracking-[0.06em] text-[var(--fg)]">
        {t('title')}
      </h3>
      <ol className="flex flex-col">
        {HELP_STEPS.map((step, index) => {
          const state = stateOf(step, progress, current);
          const view = STEP_VIEW[step];
          return (
            <li
              key={step}
              data-step={step}
              data-step-state={state}
              className={`relative transition-opacity duration-300 ${state === 'upcoming' ? 'opacity-55' : 'opacity-100'}`}
            >
              {/* 歩と歩をつなぐ縦線。番号の丸の中心を通す。 */}
              {index < HELP_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-9 bottom-0 left-[1.4rem] w-px"
                  style={{ background: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}
                />
              )}
              <button
                type="button"
                onClick={() => onOpenHref(view.href, false)}
                aria-current={state === 'current' ? 'step' : undefined}
                className={`flex w-full items-start gap-3 rounded-[10px] px-2.5 py-2 text-left ${HOVER_CLASS}`}
              >
                <span
                  className={`relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white ${state === 'current' ? 'tutorial-pulse' : ''}`}
                  style={{
                    background:
                      state === 'done'
                        ? 'color-mix(in srgb, var(--accent) 55%, var(--bg))'
                        : 'var(--accent)',
                  }}
                >
                  {state === 'done' ? (
                    <svg
                      data-done=""
                      aria-label={t('done')}
                      role="img"
                      viewBox="0 0 12 12"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.5 6.2 5 8.6l4.5-5.2" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                  <span
                    className={`text-[13px] ${state === 'done' ? 'text-[var(--date-color)] line-through decoration-[color-mix(in_srgb,var(--fg)_35%,transparent)]' : 'text-[var(--fg)]'}`}
                  >
                    {t(`${step}.title`)}
                  </span>
                  <span className="text-[11px] leading-[1.6] text-[var(--date-color)]">
                    {t(`${step}.lead`)}
                  </span>
                </span>
                <span className="mt-1 shrink-0 text-[var(--accent)]">
                  <HelpIllustration kind={view.illustration} size={34} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
