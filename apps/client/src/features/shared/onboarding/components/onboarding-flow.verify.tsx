/**
 * OnboardingFlow の検証スペック（A 移植）。
 * 4 ステップのオンボーディング・モーダル。現在の step と入力済みドラフトの有無（hasDraft）を
 * 契約として公表し、「progressbar の aria-valuenow が contract.step と一致」「入力欄は step=1 の
 * ときだけ描画」「step=1 では hasDraft に応じて次へボタンが enable/disable」を invariant＋act で
 * 孤立検証する。i18n（onboarding）依存のため withVerifyProviders（NextIntlClientProvider）で包む。
 *
 * 注: finish()（step 3 で「次へ」）は open=false → null を返して unmount するため、
 * 完了に到達する act は書かない（dom-contract が BLOCKED になる）。describe する状態は
 * 描画される step 0〜3 のみ。draft は step 1 で入力するしか変化させられない（initialDraft prop は
 * 無く initialStep は step だけを進める）ため、hasDraft=true は ctx.type 経由でのみ再現する。
 */

import { registerUnit } from '@oryzae/verify';
import type { OnboardingResult } from '@/features/shared/onboarding/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { OnboardingFlow } from './onboarding-flow';

interface Props {
  onComplete: (result: OnboardingResult) => void;
  initialStep?: number;
}

const noop = () => {};

registerUnit<Props>({
  id: 'OnboardingFlow',
  title: 'OnboardingFlow',
  description:
    '4 ステップのオンボーディング・モーダル（concept → question → editor → ferment）。step と入力ドラフトの有無を契約に公表する。',
  kind: 'component',
  render: (props) => withVerifyProviders(<OnboardingFlow {...props} />),
  fixtures: [
    {
      id: 'step-concept',
      description: '初期状態（step 0: コンセプト紹介）',
      props: { onComplete: noop, initialStep: 0 },
    },
    {
      id: 'advance-to-question',
      description: 'コンセプトで「はじめる」を押すと step 1（問い）へ進む',
      props: { onComplete: noop, initialStep: 0 },
      act: async (ctx) => {
        await ctx.click('.ob-btn-primary');
        await ctx.wait(16);
      },
    },
    {
      id: 'question-typed',
      description: 'step 1 で問いを入力すると hasDraft=true・次へボタンが有効になる',
      props: { onComplete: noop, initialStep: 1 },
      act: async (ctx) => {
        await ctx.type('input', 'なぜ自分は急ぐのが苦手なのだろう');
        await ctx.wait(16);
      },
    },
    {
      id: 'step-editor',
      description: 'step 2（エディタ紹介）',
      props: { onComplete: noop, initialStep: 2 },
    },
    {
      id: 'step-ferment',
      description: 'step 3（Jar & 発酵紹介）',
      props: { onComplete: noop, initialStep: 3 },
    },
    {
      id: 'whitespace-stays-empty',
      probe: true,
      description: 'Probe: step 1 で空白だけ入力しても hasDraft=false のまま次へボタンは disabled',
      props: { onComplete: noop, initialStep: 1 },
      act: async (ctx) => {
        await ctx.type('input', '   ');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'step-contract-matches-progressbar',
      description: 'progressbar の aria-valuenow が contract.step + 1 と一致する',
      check: ({ root, contract }) => {
        const bar = root.querySelector('[role="progressbar"]');
        const valuenow = bar?.getAttribute('aria-valuenow');
        const expected = String(Number(contract.step) + 1);
        return (
          valuenow === expected ||
          `aria-valuenow="${valuenow}" だが contract.step="${contract.step}"（期待 ${expected}）`
        );
      },
    },
    {
      id: 'input-present-iff-step-1',
      description: '入力欄（問い）は step=1 のときだけ描画される',
      check: ({ root, contract }) => {
        const hasInput = Boolean(root.querySelector('input'));
        const expectInput = contract.step === '1';
        return (
          hasInput === expectInput ||
          `input present=${hasInput} だが contract.step="${contract.step}"`
        );
      },
    },
    {
      id: 'next-button-present',
      description: 'どの step でも次へボタン（primary）が描画される',
      check: ({ root }) =>
        Boolean(root.querySelector('.ob-btn-primary')) || '次へボタン（.ob-btn-primary）が無い',
    },
    {
      id: 'concept-step-zero',
      description: '初期状態は step=0（hasDraft=false）',
      onlyFixtures: ['step-concept'],
      check: ({ contract }) =>
        (contract.step === '0' && contract.hasDraft === 'false') ||
        `expected step=0 & hasDraft=false, got step=${contract.step}, hasDraft=${contract.hasDraft}`,
    },
    {
      id: 'advances-on-next',
      description: 'コンセプトで次へを押すと step=1 に進む',
      onlyFixtures: ['advance-to-question'],
      check: ({ contract }) =>
        contract.step === '1' || `expected step=1 after next, got "${contract.step}"`,
    },
    {
      id: 'next-enabled-after-valid-input',
      description: 'step 1 で有効な問いを入力すると hasDraft=true・次へボタンが有効になる',
      onlyFixtures: ['question-typed'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('.ob-btn-primary');
        return (
          (contract.hasDraft === 'true' && btn?.disabled === false) ||
          `expected hasDraft=true & enabled, got hasDraft=${contract.hasDraft}, disabled=${btn?.disabled}`
        );
      },
    },
    {
      id: 'next-disabled-when-empty-at-step-1',
      description: 'step 1 で入力が空白のみのとき hasDraft=false・次へボタンは disabled',
      onlyFixtures: ['whitespace-stays-empty'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('.ob-btn-primary');
        return (
          (contract.hasDraft === 'false' && btn?.disabled === true) ||
          `expected hasDraft=false & disabled, got hasDraft=${contract.hasDraft}, disabled=${btn?.disabled}`
        );
      },
    },
  ],
});
