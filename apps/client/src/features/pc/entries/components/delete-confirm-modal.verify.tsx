/**
 * DeleteConfirmModal の検証スペック（A 移植）。
 * open=true で描画されるダイアログ。i18n（useTranslations）は withVerifyProviders が供給。
 * deleting 状態を契約として公表し、「削除中は両ボタン disabled（多重送信・誤キャンセル不可）」を
 * probe で検証する。open=false は null 描画で契約が出ず dom-contract が FAIL になるため
 * fixture には使わない（open=true 相当のルートにのみ契約を付与している）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { DeleteConfirmModal } from './delete-confirm-modal';

interface Props {
  open: boolean;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'DeleteConfirmModal',
  title: 'DeleteConfirmModal',
  description: 'エントリ削除の確認モーダル（削除中は操作をロック）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<DeleteConfirmModal {...props} />),
  fixtures: [
    {
      id: 'open',
      description: '開いている（削除前・操作可能）',
      props: { open: true, deleting: false, onCancel: noop, onConfirm: noop },
    },
    {
      id: 'deleting',
      probe: true,
      description: 'Probe: 削除中は両ボタン disabled（多重送信・誤キャンセル不可）',
      props: { open: true, deleting: true, onCancel: noop, onConfirm: noop },
    },
  ],
  invariants: [
    {
      id: 'deleting-contract-matches-props',
      description: 'data-verify-deleting が props.deleting と一致する',
      check: ({ contract, props }) =>
        contract.deleting === String(props.deleting ?? false) ||
        `deleting 契約不一致: props.deleting=${props.deleting} → contract.deleting=${contract.deleting}`,
    },
    {
      id: 'dialog-semantics',
      description: 'role="dialog" かつ aria-modal="true" のモーダルとして描画される',
      check: ({ root }) => {
        const dialog = root.querySelector('[data-verify-unit="DeleteConfirmModal"]');
        const isDialog = dialog?.getAttribute('role') === 'dialog';
        const isModal = dialog?.getAttribute('aria-modal') === 'true';
        return (
          (isDialog && isModal) ||
          `dialog semantics 欠落: role=${dialog?.getAttribute('role')}, aria-modal=${dialog?.getAttribute('aria-modal')}`
        );
      },
    },
    {
      id: 'buttons-locked-while-deleting',
      description: '削除中は確認・キャンセルの両ボタンが disabled',
      onlyFixtures: ['deleting'],
      check: ({ root }) => {
        const buttons = Array.from(root.querySelectorAll('button'));
        return (
          (buttons.length === 2 && buttons.every((b) => b.disabled)) ||
          `削除中にボタンがロックされていない: count=${buttons.length}, disabled=[${buttons
            .map((b) => b.disabled)
            .join(',')}]`
        );
      },
    },
    {
      id: 'buttons-enabled-when-idle',
      description: '削除前はボタンが操作可能（disabled でない）',
      onlyFixtures: ['open'],
      check: ({ root }) => {
        const buttons = Array.from(root.querySelectorAll('button'));
        return (
          (buttons.length === 2 && buttons.every((b) => !b.disabled)) ||
          `削除前なのにボタンが無効: count=${buttons.length}, disabled=[${buttons
            .map((b) => b.disabled)
            .join(',')}]`
        );
      },
    },
  ],
});
