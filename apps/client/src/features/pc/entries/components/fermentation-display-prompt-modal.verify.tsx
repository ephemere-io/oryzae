/**
 * FermentationDisplayPromptModal の検証スペック。
 * i18n（useTranslations）＋ useState（remember チェックボックス）を持つモーダル。
 * withVerifyProviders（NextIntlClientProvider）で孤立検証する。
 *
 * 注意: open=false のとき null を返すため、契約要素（[data-verify-unit]）は open=true
 * のときしか存在しない。契約/DOM を読む invariant は onlyFixtures で開いている fixture に
 * 限定する（closed fixture は contract={} になり読み戻せないため）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { FermentationDisplayPromptModal } from './fermentation-display-prompt-modal';

interface Props {
  open: boolean;
  onChoose: (display: boolean, remember: boolean) => void;
  onClose: () => void;
}

const noopChoose = (_display: boolean, _remember: boolean) => {};
const noopClose = () => {};

registerUnit<Props>({
  id: 'FermentationDisplayPromptModal',
  title: 'FermentationDisplayPromptModal',
  description:
    '問いの発酵結果をエディタ上に表示するか確認するモーダル（表示/非表示 + 次回確認しない）',
  kind: 'component',
  render: (props) => withVerifyProviders(<FermentationDisplayPromptModal {...props} />),
  fixtures: [
    {
      id: 'open-default',
      description: '初期表示（remember 未チェック）',
      props: { open: true, onChoose: noopChoose, onClose: noopClose },
    },
    {
      id: 'remember-checked',
      description: '「次回からは確認しない」をチェックした状態',
      props: { open: true, onChoose: noopChoose, onClose: noopClose },
      act: async (ctx) => {
        await ctx.click('input[type="checkbox"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'double-toggle',
      probe: true,
      description: 'Probe: チェックボックスを2回トグルすると remember=false に戻る（冪等）',
      props: { open: true, onChoose: noopChoose, onClose: noopClose },
      act: async (ctx) => {
        await ctx.click('input[type="checkbox"]');
        await ctx.click('input[type="checkbox"]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'remember-matches-checkbox',
      description: 'チェックボックスの checked が data-verify-remember と一致する',
      onlyFixtures: ['open-default', 'remember-checked'],
      check: ({ root, contract }) => {
        const checkbox = root.querySelector<HTMLInputElement>('input[type="checkbox"]');
        const checked = checkbox ? String(checkbox.checked) : 'no-checkbox';
        return (
          checked === contract.remember ||
          `checkbox.checked="${checked}", contract.remember="${contract.remember}"`
        );
      },
    },
    {
      id: 'remember-true-after-click',
      description: 'チェックボックスをクリックすると remember=true になる',
      onlyFixtures: ['remember-checked'],
      check: ({ contract }) =>
        contract.remember === 'true' ||
        `expected remember=true after click, got "${contract.remember}"`,
    },
    {
      id: 'dialog-rendered-when-open',
      description: 'open=true のとき role="dialog" が描画される',
      onlyFixtures: ['open-default', 'remember-checked'],
      check: ({ root }) =>
        Boolean(root.querySelector('[role="dialog"]')) || 'role="dialog" が描画されていない',
    },
    {
      id: 'remember-resets-on-double-toggle',
      description: '2回トグル後は remember=false（チェックが解除される）',
      onlyFixtures: ['double-toggle'],
      check: ({ contract }) =>
        contract.remember === 'false' ||
        `expected remember=false after double toggle, got "${contract.remember}"`,
    },
  ],
});
