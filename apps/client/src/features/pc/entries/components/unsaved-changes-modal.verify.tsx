/**
 * UnsavedChangesModal の検証スペック。
 * props（open + 3コールバック）と i18n のみに依存する制御モーダル。withVerifyProviders で
 * 孤立検証できる。open=false は null を返し DOM 契約を出さない（dom-contract verifier が FAIL に
 * する）ため、全 fixture は open=true で回す。probe は「親が open を握る制御コンポーネントなので、
 * ボタンを押しても自分では閉じない」という契約を act で突く。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { UnsavedChangesModal } from './unsaved-changes-modal';

interface UnsavedChangesModalProps {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

const noop = () => {};

const baseProps: UnsavedChangesModalProps = {
  open: true,
  onSave: noop,
  onDiscard: noop,
  onClose: noop,
};

registerUnit<UnsavedChangesModalProps>({
  id: 'UnsavedChangesModal',
  title: 'UnsavedChangesModal',
  description: '未保存の変更があるときの確認モーダル（保存する / 保存しない）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<UnsavedChangesModal {...props} />),
  fixtures: [
    {
      id: 'open',
      description: '表示状態（open=true）',
      props: { ...baseProps },
    },
    {
      id: 'click-discard-stays-open',
      probe: true,
      description:
        'Probe: 制御コンポーネントなので「保存しない」を押しても自分では閉じない（open は親が握る）',
      props: { ...baseProps },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'open-contract-true',
      description: 'レンダリングされている＝contract.open は true',
      check: ({ contract }) =>
        contract.open === 'true' || `expected open="true", got "${contract.open}"`,
    },
    {
      id: 'heading-rendered',
      description: '見出し（i18n: entries.unsaved_modal.heading）が表示される',
      check: ({ root }) =>
        Boolean(root.textContent?.includes('未保存の変更があります')) ||
        '見出しテキストが描画されていない',
    },
    {
      id: 'two-action-buttons',
      description: '「保存しない」「保存する」の2ボタンが揃っている',
      check: ({ root }) => {
        const labels = Array.from(root.querySelectorAll('button')).map((b) =>
          b.textContent?.trim(),
        );
        return (
          (labels.includes('保存しない') && labels.includes('保存する')) ||
          `action buttons not both rendered: ${JSON.stringify(labels)}`
        );
      },
    },
    {
      id: 'never-self-closes',
      description: 'ボタンを押しても自分では閉じない（dialog が残る）',
      onlyFixtures: ['click-discard-stays-open'],
      check: ({ root }) =>
        Boolean(root.querySelector('[role="dialog"]')) ||
        'クリック後に dialog が消えた（自分で閉じてしまっている）',
    },
  ],
});
