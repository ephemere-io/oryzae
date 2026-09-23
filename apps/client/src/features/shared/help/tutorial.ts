import type { HelpProgress, HelpStepId } from './types';

/** 歩の順。そのままこのアプリの筋書き（問いを立てる → 書く → 紐づける → 漬けて待つ → 読む）。 */
export const HELP_STEPS: readonly HelpStepId[] = ['question', 'write', 'link', 'pickle', 'read'];

/**
 * いまの歩 — まだ済んでいない最初の歩。全部済んでいれば null（案内は終わり）。
 * 進み具合が分からないうちも null（分からないまま急かさない）。
 */
export function currentHelpStep(progress: HelpProgress | null): HelpStepId | null {
  if (!progress) return null;
  return HELP_STEPS.find((step) => !progress[step]) ?? null;
}
