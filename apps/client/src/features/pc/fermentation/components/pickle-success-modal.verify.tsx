/**
 * PickleSuccessModal の検証スペック（A 移植）。
 * Issue #322 の漬け込み完了お知らせモーダル。open=true で描画される制御モーダルで、
 * i18n（useTranslations）は withVerifyProviders が供給。
 *
 * このコンポーネントは状態を持たない（open は親が制御）ため、契約値で discriminate
 * できる状態が無い。よって invariant は DOM/振る舞いベースにする:
 *   - dialog セマンティクス（role/aria-modal）
 *   - 見出し・本文・dismiss テキストの描画
 *   - dismiss CTA は1つだけ（アクセシブルネームあり）
 * probe は act でdismiss を押しても自分では閉じない（close は親の責務）ことを検証する。
 * open=false は null 描画で契約が出ず dom-contract が FAIL になるため fixture には使わない。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { PickleSuccessModal } from './pickle-success-modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'PickleSuccessModal',
  title: 'PickleSuccessModal',
  description: '漬け込み完了お知らせモーダル（ブランドマーク + dismiss ボタン）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<PickleSuccessModal {...props} />),
  fixtures: [
    {
      id: 'open',
      description: '開いている（漬け込み完了メッセージを表示）',
      props: { open: true, onClose: noop },
    },
    {
      id: 'dismiss-no-self-close',
      probe: true,
      description: 'Probe: 制御モーダル — dismiss を押しても自分では閉じない（close は親の責務）',
      props: { open: true, onClose: noop },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'dialog-semantics',
      description: 'role="dialog" かつ aria-modal="true" のモーダルとして描画される',
      check: ({ root }) => {
        const dialog = root.querySelector('[data-verify-unit="PickleSuccessModal"]');
        const isDialog = dialog?.getAttribute('role') === 'dialog';
        const isModal = dialog?.getAttribute('aria-modal') === 'true';
        return (
          (isDialog && isModal) ||
          `dialog semantics 欠落: role=${dialog?.getAttribute('role')}, aria-modal=${dialog?.getAttribute('aria-modal')}`
        );
      },
    },
    {
      id: 'content-rendered',
      description: '見出し・本文・dismiss ラベルが描画される',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        const heading = '発酵瓶に漬け込まれました';
        const body = 'あなたのテキストと問いが発酵瓶に漬け込まれました';
        const dismiss = 'わかりました';
        const missing = [heading, body, dismiss].filter((s) => !text.includes(s));
        return missing.length === 0 || `未描画のテキスト: ${missing.join(' / ')}`;
      },
    },
    {
      id: 'single-dismiss-cta',
      description: 'dismiss CTA は1つだけ、かつアクセシブルネームを持つ',
      check: ({ root }) => {
        const buttons = Array.from(root.querySelectorAll('button'));
        if (buttons.length !== 1) return `button が1つでない: count=${buttons.length}`;
        const name = (buttons[0].textContent ?? '').trim() || buttons[0].getAttribute('aria-label');
        return Boolean(name) || 'dismiss ボタンにアクセシブルネーム（テキスト/aria-label）が無い';
      },
    },
    {
      id: 'controlled-modal-stays-open',
      description: 'dismiss を押しても自分では閉じない（依然として描画される）',
      onlyFixtures: ['dismiss-no-self-close'],
      check: ({ root }) => {
        const dialog = root.querySelector('[data-verify-unit="PickleSuccessModal"]');
        return (
          Boolean(dialog) ||
          'dismiss 後にモーダルが消えた（内部 state で閉じている疑い。close は親の責務）'
        );
      },
    },
  ],
});
