/**
 * SpConfirmSheet の検証スペック（SP 汎用確認ボトムシート・Issue #363）。
 *
 * 純表示コンポーネント（データ取得なし・ラベルは props）。状態は props で制御されるため、
 * fixture は props 組み合わせで網羅する。i18n/router/auth は使わないが、慣習に合わせ
 * withVerifyProviders で包む（副作用なし）。
 *
 * 公表する契約は実際に変化する状態のみ: open / busy / destructive。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpConfirmSheet } from './sp-confirm-sheet';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const base = {
  title: '本当に削除しますか？',
  message: 'このエントリーは完全に削除され、元に戻すことはできません。',
  confirmLabel: '削除する',
  cancelLabel: 'キャンセル',
  onConfirm: () => {},
  onCancel: () => {},
};

registerUnit<Props>({
  id: 'SpConfirmSheet',
  title: 'SpConfirmSheet',
  description: 'SP 汎用確認ボトムシート（削除等の確認に使う・確定/取消ボタン）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SpConfirmSheet {...props} />),
  fixtures: [
    {
      id: 'closed',
      probe: true,
      description: 'Probe: open=false のときはパネルもボタンも描画しない',
      props: { ...base, open: false },
    },
    {
      id: 'open',
      description: 'open=true でタイトル・本文・確定/取消ボタンを描画する（破壊的＝警告色）',
      props: { ...base, open: true, destructive: true },
    },
    {
      id: 'busy',
      probe: true,
      description: 'Probe: busy=true は実行中なので確定/取消ボタンが disabled（多重実行不可）',
      props: { ...base, open: true, destructive: true, busy: true },
    },
  ],
  invariants: [
    {
      id: 'panel-present-iff-open',
      description: 'パネル（fixed オーバーレイ）は open=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasPanel = Boolean(root.querySelector('.fixed'));
        const expectOpen = contract.open === 'true';
        return (
          hasPanel === expectOpen ||
          `panel present=${hasPanel} だが contract.open="${contract.open}"`
        );
      },
    },
    {
      id: 'labels-present-when-open',
      description: 'open=true のとき確定/取消ラベルが描画される',
      onlyFixtures: ['open', 'busy'],
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return (
          (text.includes('削除する') && text.includes('キャンセル')) ||
          `確定/取消ラベルが見つからない: "${text}"`
        );
      },
    },
    {
      id: 'action-buttons-disabled-iff-busy',
      description: 'open 時、確定ボタンの disabled は busy と一致する',
      onlyFixtures: ['open', 'busy'],
      check: ({ root, contract }) => {
        // 末尾のボタン = 確定ボタン（オーバーレイ・取消・確定の順）。
        const buttons = root.querySelectorAll<HTMLButtonElement>('button');
        const confirm = buttons[buttons.length - 1];
        const disabled = confirm?.disabled === true;
        const expectBusy = contract.busy === 'true';
        return (
          disabled === expectBusy ||
          `確定ボタン disabled=${disabled} だが contract.busy="${contract.busy}"`
        );
      },
    },
    {
      id: 'closed-renders-nothing',
      description: 'open=false ではボタンを一切描画しない',
      onlyFixtures: ['closed'],
      check: ({ root }) =>
        root.querySelectorAll('button').length === 0 || 'open=false なのにボタンが描画されている',
    },
  ],
});
