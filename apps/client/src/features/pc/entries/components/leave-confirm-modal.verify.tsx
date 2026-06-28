/**
 * LeaveConfirmModal の検証スペック。
 * i18n 依存の制御コンポーネント（open は親が持つ完全制御）。withVerifyProviders で
 * i18n を供給して孤立検証する。クリックでは DOM/契約が変わらない（制御コンポーネント）ため、
 * コールバック配線はモジュールスコープの spy をクロージャ経由で観測して検証する
 * （props.onCancel は () => void 型で .calls を持てないので props 経由では観測しない）。
 *
 * open=false は null を返し契約を出さない（dom-contract が fail になる）ため、
 * fixture は常に open=true。閉じた分岐は観測不能なので invariant では主張しない。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { LeaveConfirmModal } from './leave-confirm-modal';

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// fixture の handler と invariant の双方からクロージャで参照する観測用カウンタ。
// 各 act の先頭で関連カウンタをリセットし、実行順序や replay 再実行に依存しないようにする。
const spy = { cancel: 0, confirm: 0 };

const handlers = {
  onCancel: () => {
    spy.cancel += 1;
  },
  onConfirm: () => {
    spy.confirm += 1;
  },
};

registerUnit<Props>({
  id: 'LeaveConfirmModal',
  title: 'LeaveConfirmModal',
  description: '離脱確認モーダル（未保存の変更がある状態でエディタを離れるときの確認ダイアログ）',
  kind: 'component',
  render: (props) => withVerifyProviders(<LeaveConfirmModal {...props} />),
  fixtures: [
    {
      id: 'open',
      description: '開いた状態（初期表示）',
      props: { open: true, ...handlers },
    },
    {
      id: 'cancel-click',
      description: 'キャンセルボタン押下で onCancel が呼ばれる',
      props: { open: true, ...handlers },
      act: async (ctx) => {
        spy.cancel = 0;
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
    {
      id: 'confirm-click',
      description: 'OK ボタン押下で onConfirm が呼ばれる',
      props: { open: true, ...handlers },
      act: async (ctx) => {
        spy.confirm = 0;
        await ctx.click('button:last-child');
        await ctx.wait(16);
      },
    },
    {
      id: 'inside-click-does-not-dismiss',
      probe: true,
      description: 'Probe: 中身（見出し）クリックは stopPropagation で onCancel を発火させない',
      props: { open: true, ...handlers },
      act: async (ctx) => {
        spy.cancel = 0;
        await ctx.click('h3');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'dialog-contract',
      description: 'role="dialog" のルートが LeaveConfirmModal 契約を公表する',
      check: ({ root, contract }) => {
        const hasDialog = Boolean(root.querySelector('[role="dialog"]'));
        return (
          (hasDialog && contract.unit === 'LeaveConfirmModal') ||
          `dialog=${hasDialog}, contract.unit="${contract.unit}"`
        );
      },
    },
    {
      id: 'two-action-buttons',
      description: 'アクションボタンが2つ（キャンセル / OK）描画される',
      check: ({ root }) => {
        const count = root.querySelectorAll('button').length;
        return count === 2 || `expected 2 buttons, got ${count}`;
      },
    },
    {
      id: 'labels-rendered',
      description: 'ja.json のラベル（キャンセル / OK）が表示される',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return (
          (text.includes('キャンセル') && text.includes('OK')) || `labels missing in: "${text}"`
        );
      },
    },
    {
      id: 'cancel-fires-on-cancel-click',
      description: 'キャンセル押下後に onCancel が1回呼ばれている',
      onlyFixtures: ['cancel-click'],
      check: () => spy.cancel === 1 || `expected onCancel called once, got ${spy.cancel}`,
    },
    {
      id: 'confirm-fires-on-confirm-click',
      description: 'OK 押下後に onConfirm が1回呼ばれている',
      onlyFixtures: ['confirm-click'],
      check: () => spy.confirm === 1 || `expected onConfirm called once, got ${spy.confirm}`,
    },
    {
      id: 'inside-click-no-dismiss',
      description: '中身クリックでは onCancel が呼ばれない（stopPropagation）',
      onlyFixtures: ['inside-click-does-not-dismiss'],
      check: () =>
        spy.cancel === 0 || `inside click should not dismiss, but onCancel fired ${spy.cancel}x`,
    },
  ],
});
