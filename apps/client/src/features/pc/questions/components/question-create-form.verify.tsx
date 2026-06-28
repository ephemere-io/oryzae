/**
 * QuestionCreateForm の検証スペック（A 移植）。
 * 新しい問いを追加する入力フォーム。入力の有無（empty）と送信中（creating）を契約として
 * 公表し、「送信ボタンの disabled が contract と一致」「contract.empty が入力値を正しく反映」を
 * invariant＋act で孤立検証する。i18n（questions.create_form）依存のため
 * withVerifyProviders（NextIntlClientProvider）で包む。
 *
 * creating=true は handleSubmit 内でしか到達できないため、resolve しない Promise を
 * onSubmit に渡して送信中状態を再現する（setCreating(false) が走らず creating が立ち続ける）。
 * CI 必須の probe は実証済みの ctx.type 経路に載る whitespace ケースに置く。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionCreateForm } from './question-create-form';

interface Props {
  onSubmit: (text: string) => Promise<void>;
}

const noop = () => Promise.resolve();
// 送信中状態を保持するため解決しない Promise（setCreating(false) を発火させない）。
const neverResolve = () => new Promise<void>(() => {});

registerUnit<Props>({
  id: 'QuestionCreateForm',
  title: 'QuestionCreateForm',
  description: '新しい問いを追加する入力フォーム（入力の有無・送信中で送信ボタンをロック）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<QuestionCreateForm {...props} />),
  fixtures: [
    {
      id: 'empty',
      description: '初期状態（入力なし・送信ボタンは disabled）',
      props: { onSubmit: noop },
    },
    {
      id: 'typed',
      description: '文字を入力すると送信ボタンが有効になる',
      props: { onSubmit: noop },
      act: async (ctx) => {
        await ctx.type('input', '今日の問い');
        await ctx.wait(16);
      },
    },
    {
      id: 'creating',
      description: '送信中（in-flight）はボタンが disabled になり多重送信を防ぐ',
      props: { onSubmit: neverResolve },
      act: async (ctx) => {
        await ctx.type('input', '今日の問い');
        await ctx.wait(16);
        await ctx.click('button[type="submit"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'whitespace-only',
      probe: true,
      description: 'Probe: 空白だけ入力しても empty 扱いで送信ボタンは disabled のまま',
      props: { onSubmit: noop },
      act: async (ctx) => {
        await ctx.type('input', '   ');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'submit-disabled-matches-contract',
      description: '送信ボタンの disabled が contract（empty || creating）と一致する',
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        const expectedDisabled = contract.empty === 'true' || contract.creating === 'true';
        return (
          btn?.disabled === expectedDisabled ||
          `disabled=${btn?.disabled}, expected=${expectedDisabled} (empty=${contract.empty}, creating=${contract.creating})`
        );
      },
    },
    {
      id: 'empty-contract-reflects-input',
      description: 'contract.empty が入力値の trim 結果を正しく反映する',
      check: ({ root, contract }) => {
        const input = root.querySelector<HTMLInputElement>('input[type="text"]');
        const actuallyEmpty = (input?.value ?? '').trim().length === 0;
        return (
          contract.empty === String(actuallyEmpty) ||
          `contract.empty="${contract.empty}" だが input.value="${input?.value}"（trim 後 empty=${actuallyEmpty}）`
        );
      },
    },
    {
      id: 'idle-disabled-when-empty',
      description: '初期状態は入力なしで送信ボタンが disabled',
      onlyFixtures: ['empty'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        return (
          (contract.empty === 'true' && btn?.disabled === true) ||
          `expected empty=true & disabled, got empty=${contract.empty}, disabled=${btn?.disabled}`
        );
      },
    },
    {
      id: 'enabled-after-typing',
      description: '入力後は送信ボタンが有効（empty=false・disabled でない）',
      onlyFixtures: ['typed'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        return (
          (contract.empty === 'false' && btn?.disabled === false) ||
          `expected empty=false & enabled, got empty=${contract.empty}, disabled=${btn?.disabled}`
        );
      },
    },
    {
      id: 'locked-while-creating',
      description: '送信中はボタンが disabled（creating=true で多重送信不可）',
      onlyFixtures: ['creating'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        return (
          (contract.creating === 'true' && btn?.disabled === true) ||
          `expected creating=true & disabled, got creating=${contract.creating}, disabled=${btn?.disabled}`
        );
      },
    },
    {
      id: 'whitespace-stays-empty',
      description: '空白のみ入力でも empty=true のままで送信ボタンは disabled',
      onlyFixtures: ['whitespace-only'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        return (
          (contract.empty === 'true' && btn?.disabled === true) ||
          `expected empty=true & disabled after whitespace, got empty=${contract.empty}, disabled=${btn?.disabled}`
        );
      },
    },
  ],
});
