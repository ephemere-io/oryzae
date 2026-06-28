/**
 * PickleConfirmModal の検証スペック。
 * props だけで孤立レンダリングできる純表示モーダル（内部 state なし）。
 * i18n（useTranslations）は withVerifyProviders が供給する。open=true 相当の
 * dialog ルートに contract（saving / linkedCount）を公表し、prop→DOM の一致を検証する。
 *
 * 内部 state を持たない（open/saving は props、ボタンは callback を呼ぶだけ）ため、
 * act でクリックしても観測可能な DOM 遷移は起きない。よって EditorStatusBar 同様、
 * 複数の prop 駆動 fixture + invariant で検証する（act fixture は持たない）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { PickleConfirmModal } from './pickle-confirm-modal';

interface Props {
  open: boolean;
  saving: boolean;
  title: string;
  linkedQuestionTexts: string[];
  onConfirm: () => void;
  onClose: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'PickleConfirmModal',
  title: 'PickleConfirmModal',
  description: 'タイトル×問いありエントリを瓶に漬け込む確認モーダル（純表示・props 駆動）',
  kind: 'component',
  render: (props) => withVerifyProviders(<PickleConfirmModal {...props} />),
  fixtures: [
    {
      id: 'default',
      description: '問い2件付き・通常状態',
      props: {
        open: true,
        saving: false,
        title: '今日のふりかえり',
        linkedQuestionTexts: ['なぜそう感じた？', '次はどうする？'],
        onConfirm: noop,
        onClose: noop,
      },
    },
    {
      id: 'saving',
      description: '漬け込み中（confirm ボタン disabled）',
      props: {
        open: true,
        saving: true,
        title: '今日のふりかえり',
        linkedQuestionTexts: ['なぜそう感じた？'],
        onConfirm: noop,
        onClose: noop,
      },
    },
    {
      id: 'no-links',
      probe: true,
      description: 'Probe: 紐付く問いが 0 件でも崩れない（チップ列が描画されない）',
      props: {
        open: true,
        saving: false,
        title: 'メモ',
        linkedQuestionTexts: [],
        onConfirm: noop,
        onClose: noop,
      },
    },
    {
      id: 'long-title-many-links',
      probe: true,
      description: 'Probe: 長いタイトル・多数の問いでもレイアウトが崩れない',
      props: {
        open: true,
        saving: false,
        title: 'あ'.repeat(120),
        linkedQuestionTexts: Array.from(
          { length: 8 },
          (_, i) => `問い${i + 1}についての長めの本文`,
        ),
        onConfirm: noop,
        onClose: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'title-in-body',
      description: '本文コピーにタイトルが差し込まれて表示される',
      check: ({ root, props }) =>
        Boolean(root.textContent?.includes(props.title)) ||
        `title "${props.title}" が本文に描画されていない`,
    },
    {
      id: 'saving-disables-confirm',
      description: 'saving 契約と confirm ボタンの disabled が一致する',
      check: ({ root, contract }) => {
        const buttons = root.querySelectorAll('button');
        const confirmButton = buttons[buttons.length - 1];
        if (!confirmButton) return 'confirm ボタンが見つからない';
        const expectedDisabled = contract.saving === 'true';
        return (
          confirmButton.disabled === expectedDisabled ||
          `disabled 契約不一致: contract.saving=${contract.saving}, button.disabled=${confirmButton.disabled}`
        );
      },
    },
    {
      id: 'linked-count-matches-chips',
      description: 'linkedCount 契約と描画されたチップ数が一致する',
      check: ({ root, contract }) => {
        const chips = root.querySelectorAll('.rounded-full');
        const expected = Number(contract.linkedCount);
        return (
          chips.length === expected ||
          `チップ数不一致: contract.linkedCount=${contract.linkedCount}, チップ要素数=${chips.length}`
        );
      },
    },
  ],
});
