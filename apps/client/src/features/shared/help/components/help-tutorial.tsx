'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { CONTROL_FONT, HOVER_CLASS, ICON_STROKE_WIDTH } from '@/components/ui/surface';
import { HELP_STEPS } from '../tutorial';
import type { HelpIllustrationKind, HelpProgress, HelpStepId } from '../types';
import { HelpIllustration } from './help-illustrations';

/** 歩ごとの線画と行き先。順は `HELP_STEPS`。 */
const STEP_VIEW: Record<HelpStepId, { illustration: HelpIllustrationKind; href: string }> = {
  question: { illustration: 'question', href: '/jar' },
  write: { illustration: 'pen', href: '/entries/new' },
  link: { illustration: 'timeline', href: '/entries/new' },
  pickle: { illustration: 'jar', href: '/entries/new' },
  read: { illustration: 'letter', href: '/jar' },
};

export interface HelpTutorialProps {
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
 * 「チュートリアル」— このアプリの筋書きを五歩で辿る。
 *
 * 問いを立てる → エントリーを書く → 問いを紐づける → 瓶に漬けて待つ → 手紙を読む。
 * 一個ずつ済ませていく。済んだ歩は番号が印になり、いまの歩は番号が脈打つ（画面の中の
 * 相手 — 「問いを追加する」のボタンなど — も同じ脈で灯る。`docs/help-mode-guide.md`）。
 * まだの歩は薄い。四歩目には最初の手紙が届く条件（言語ごとの文字数）を添える —
 * 何も起きない時間を「壊れている」と思わせないため。進み具合はサーバーの旗そのもので、
 * ここでは憶えない。
 *
 * 面の中の位置は変わらない（検索欄 → 画面の 1 枚 → ここ → 一覧）。五歩とも済むと
 * アコーディオンが閉じて、見出しだけが残る。開き直せる。
 */
export function HelpTutorial({ onOpenHref, progress = null, current = null }: HelpTutorialProps) {
  const t = useTranslations('help.steps');
  const bodyId = useId();
  const doneSteps = HELP_STEPS.filter((step) => progress?.[step]);
  const complete = progress !== null && doneSteps.length === HELP_STEPS.length;
  // null は「既定に従う」— 済んでいなければ開き、済んでいれば閉じる。押せば覚える。
  const [opened, setOpened] = useState<boolean | null>(null);
  useEffect(() => {
    // 最後の歩が済んだ瞬間に畳む（手で開いていても）。
    if (complete) setOpened(null);
  }, [complete]);
  const open = opened ?? !complete;

  return (
    <section
      {...verifyAttrs({
        unit: 'HelpTutorial',
        stepCount: HELP_STEPS.length,
        current: current ?? 'none',
        done: doneSteps.length === 0 ? 'none' : doneSteps.join(','),
        complete,
        open,
      })}
      className="flex flex-col"
      style={CONTROL_FONT}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={t('toggle')}
        onClick={() => setOpened(!open)}
        className={`flex w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left ${HOVER_CLASS}`}
      >
        <span className="text-[12px] font-medium tracking-[0.06em] text-[var(--fg)]">
          {t('title')}
        </span>
        {progress !== null && !complete && (
          <span className="text-[10.5px] tabular-nums text-[var(--date-color)]">
            {doneSteps.length}/{HELP_STEPS.length}
          </span>
        )}
        {complete && (
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-white"
            style={{ background: 'color-mix(in srgb, var(--accent) 55%, var(--bg))' }}
          >
            <CheckIcon />
          </span>
        )}
        <span className="flex-1" />
        <svg
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-[var(--date-color)] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={ICON_STROKE_WIDTH}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {/* 本文は常に DOM に居て、grid-template-rows を 0fr ⇄ 1fr で遷移させる（話題の行と同じ作り）。 */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div
          id={bodyId}
          data-tutorial-body=""
          className={`min-h-0 overflow-hidden transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
          inert={!open}
          aria-hidden={!open}
        >
          <ol className="flex flex-col pt-0.5">
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
                        <span data-done="" role="img" aria-label={t('done')}>
                          <CheckIcon />
                        </span>
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
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
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
  );
}
