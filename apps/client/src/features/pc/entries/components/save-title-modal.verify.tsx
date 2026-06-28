/**
 * SaveTitleModal の検証スペック（A 移植）。
 * props だけで孤立レンダリングできるモーダル（open/saving/initialTitle を持つ）。
 * i18n は withVerifyProviders（NextIntlClientProvider）が供給。
 * 「saving 契約と submit ボタンの disabled の一致」「input が initialTitle を反映」
 * を invariant＋act（入力）で検証する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SaveTitleModal } from './save-title-modal';

interface SaveTitleModalProps {
  open: boolean;
  initialTitle: string;
  saving: boolean;
  onSave: (title: string) => void;
  onClose: () => void;
  heading?: string;
  submitLabel?: string;
}

const noop = () => {};

registerUnit<SaveTitleModalProps>({
  id: 'SaveTitleModal',
  title: 'SaveTitleModal',
  description: 'エントリ保存時のタイトル入力モーダル（open/saving 状態を持つ）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SaveTitleModal {...props} />),
  fixtures: [
    {
      id: 'default',
      description: '通常表示（タイトル入力済み、保存可能）',
      props: {
        open: true,
        initialTitle: '今日のジャーナル',
        saving: false,
        onSave: noop,
        onClose: noop,
      },
    },
    {
      id: 'saving',
      description: '保存中（in-flight）。submit ボタンが disabled になる',
      props: {
        open: true,
        initialTitle: '今日のジャーナル',
        saving: true,
        onSave: noop,
        onClose: noop,
      },
    },
    {
      id: 'custom-labels',
      description: 'heading / submitLabel を上書き（漬け込み導線）',
      props: {
        open: true,
        initialTitle: '下書き',
        saving: false,
        onSave: noop,
        onClose: noop,
        heading: 'エントリを瓶に漬け込む',
        submitLabel: '漬け込む',
      },
    },
    {
      id: 'typed',
      description: 'マウント後に input へ入力する（入力が反映される）',
      props: {
        open: true,
        initialTitle: '今日のジャーナル',
        saving: false,
        onSave: noop,
        onClose: noop,
      },
      act: async (ctx) => {
        await ctx.type('input', '書き換えたタイトル');
        await ctx.wait(16);
      },
    },
    {
      id: 'empty-title',
      probe: true,
      description: 'Probe: initialTitle が空でも崩れず開く（placeholder 表示）',
      props: {
        open: true,
        initialTitle: '',
        saving: false,
        onSave: noop,
        onClose: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'dialog-rendered',
      description: 'open=true のとき role="dialog" が描画される',
      check: ({ root, contract }) => {
        const dialog = root.querySelector('[role="dialog"]');
        return (
          (Boolean(dialog) && contract.open === 'true') ||
          `dialog 未描画 または contract.open 不一致: open=${contract.open}`
        );
      },
    },
    {
      id: 'submit-disabled-matches-saving',
      description: 'submit ボタンの disabled が saving 契約と一致する',
      check: ({ root, contract }) => {
        const submit = root.querySelector('button[type="submit"]');
        const disabled = submit instanceof HTMLButtonElement ? submit.disabled : null;
        if (disabled === null) return 'submit ボタンが見つからない';
        return (
          disabled === (contract.saving === 'true') ||
          `disabled=${disabled} だが contract.saving=${contract.saving}`
        );
      },
    },
    {
      id: 'input-reflects-initial-title',
      description: '初期描画時、input の値が initialTitle と一致する',
      onlyFixtures: ['default', 'saving', 'custom-labels', 'empty-title'],
      check: ({ root, props }) => {
        const input = root.querySelector('input');
        const value = input instanceof HTMLInputElement ? input.value : null;
        if (value === null) return 'input が見つからない';
        return (
          value === props.initialTitle ||
          `input.value="${value}" だが initialTitle="${props.initialTitle}"`
        );
      },
    },
    {
      id: 'input-reflects-typed-text',
      description: '入力後、input の値が入力テキストを反映する',
      onlyFixtures: ['typed'],
      check: ({ root }) => {
        const input = root.querySelector('input');
        const value = input instanceof HTMLInputElement ? input.value : null;
        if (value === null) return 'input が見つからない';
        return (
          value.includes('書き換えたタイトル') || `入力が反映されていない: input.value="${value}"`
        );
      },
    },
  ],
});
