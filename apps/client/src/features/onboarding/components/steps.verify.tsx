/**
 * StepQuestion の検証スペック（A 移植）。
 * オンボーディング2枚目「最初の問い」入力ステップ。draft の trim 長（1〜64字）で
 * 「進む」ボタンの活性を決める唯一の振る舞いを持つステップを切り出して検証する。
 *
 * StepQuestion は controlled（draft/setDraft が props）なので question-create-form 流の
 * act タイプは効かない（onChange→setDraft が親 state を更新しない＝valid が変わらない）。
 * よって draft を直接渡す静的 fixture で valid 契約とボタン disabled を検証する。
 * i18n（onboarding.step_question）依存のため withVerifyProviders で包む。
 *
 * 契約は .ob-card-inner（fragment のため単一ルートが無い／ラッパー div は見た目を変える
 * ので追加しない）に付与。FooterBar の「進む」ボタンは root 直下の兄弟なので root から拾える。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { StepQuestion } from './steps';

interface Props {
  onNext: () => void;
  draft: string;
  setDraft: (value: string) => void;
}

const noop = () => {};
const overLimit = 'あ'.repeat(65);

registerUnit<Props>({
  id: 'StepQuestion',
  title: 'StepQuestion',
  description:
    'オンボーディングの「最初の問い」入力ステップ（1〜64字のときだけ「進む」を活性化）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<StepQuestion {...props} />),
  fixtures: [
    {
      id: 'empty',
      description: '初期状態（入力なし・「進む」は disabled）',
      props: { draft: '', setDraft: noop, onNext: noop },
    },
    {
      id: 'valid',
      description: '有効な問いを入力済み（「進む」が活性）',
      props: { draft: 'なぜ自分は急ぐのが苦手なのだろう', setDraft: noop, onNext: noop },
    },
    {
      id: 'whitespace-only',
      probe: true,
      description: 'Probe: 空白だけは trim 後 empty 扱いで「進む」は disabled のまま',
      props: { draft: '   ', setDraft: noop, onNext: noop },
    },
    {
      id: 'over-limit',
      probe: true,
      description:
        'Probe: 65字（trim 後 >64）は disabled。live の maxLength=64 では到達不能でもゲートが守る。',
      props: { draft: overLimit, setDraft: noop, onNext: noop },
    },
  ],
  invariants: [
    {
      id: 'valid-contract-matches-input',
      description: 'contract.valid が input.value の trim 長（1〜64）を正しく反映する',
      check: ({ root, contract }) => {
        const input = root.querySelector<HTMLInputElement>('input[type="text"]');
        const len = (input?.value ?? '').trim().length;
        const actuallyValid = len > 0 && len <= 64;
        return (
          contract.valid === String(actuallyValid) ||
          `contract.valid="${contract.valid}" だが input.value の trim 長=${len}（valid=${actuallyValid}）`
        );
      },
    },
    {
      id: 'next-disabled-matches-contract',
      description: '「進む」ボタンの disabled が contract.valid と逆相で一致する',
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="button"]');
        const expectedDisabled = contract.valid === 'false';
        return (
          btn?.disabled === expectedDisabled ||
          `disabled=${btn?.disabled}, expected=${expectedDisabled}（contract.valid=${contract.valid}）`
        );
      },
    },
    {
      id: 'enabled-when-valid',
      description: '有効入力時は「進む」が活性（valid=true・disabled でない）',
      onlyFixtures: ['valid'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="button"]');
        return (
          (contract.valid === 'true' && btn?.disabled === false) ||
          `expected valid=true & enabled, got valid=${contract.valid}, disabled=${btn?.disabled}`
        );
      },
    },
    {
      id: 'whitespace-stays-disabled',
      description: '空白のみは valid=false のまま「進む」が disabled',
      onlyFixtures: ['whitespace-only'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="button"]');
        return (
          (contract.valid === 'false' && btn?.disabled === true) ||
          `expected valid=false & disabled after whitespace, got valid=${contract.valid}, disabled=${btn?.disabled}`
        );
      },
    },
    {
      id: 'over-limit-stays-disabled',
      description: '65字（>64）は valid=false で「進む」が disabled',
      onlyFixtures: ['over-limit'],
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="button"]');
        return (
          (contract.valid === 'false' && btn?.disabled === true) ||
          `expected valid=false & disabled at 65 chars, got valid=${contract.valid}, disabled=${btn?.disabled}`
        );
      },
    },
  ],
});
