/**
 * LinkQuestionNudgeModal の検証スペック。
 * i18n 依存の制御モーダル（open/onClose は親が所有）を、withVerifyProviders で孤立検証する。
 *
 * 注意: これは「制御」モーダル。dismiss/オーバーレイのクリックは onClose を呼ぶだけで、
 * 自分の open を倒さない。孤立レンダリングでは親が居ないため、クリック後もモーダルは
 * そのまま残る。probe はこの「クローズは親に委譲される」契約を固定する。
 * また open=false は null を返し DOM 契約が出ない（dom-contract verifier が FAIL になる）ため、
 * fixture は全て open=true で描画する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { LinkQuestionNudgeModal } from './link-question-nudge-modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'LinkQuestionNudgeModal',
  title: 'LinkQuestionNudgeModal',
  description: '問い紐付けを促す案内モーダル（Issue #316・制御モーダル）',
  kind: 'component',
  render: (props) => withVerifyProviders(<LinkQuestionNudgeModal {...props} />),
  fixtures: [
    {
      id: 'open',
      description: '表示中（open=true）',
      props: { open: true, onClose: noop },
    },
    {
      id: 'dismiss-click',
      probe: true,
      description: 'Probe: dismiss をクリックしても（制御モーダルなので）孤立時はモーダルが残る',
      props: { open: true, onClose: noop },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'dialog-role-present',
      description: 'role="dialog" かつ aria-modal の要素が存在する',
      check: ({ root }) => {
        const dialog = root.querySelector('[role="dialog"]');
        return (
          dialog?.getAttribute('aria-modal') === 'true' ||
          'role="dialog" / aria-modal="true" の要素が描画されていない'
        );
      },
    },
    {
      id: 'open-contract',
      description: 'data-verify-open が true（表示中）',
      check: ({ contract }) =>
        contract.open === 'true' || `expected open="true", got "${contract.open}"`,
    },
    {
      id: 'heading-text-resolved',
      description: '見出しが i18n 解決済みで非空（生キーが出ていない）',
      check: ({ root }) => {
        const heading = root.querySelector('h3');
        const text = heading?.textContent?.trim() ?? '';
        return (
          (text.length > 0 && !text.includes('link_question_nudge_modal')) ||
          `見出しテキストが解決されていない: "${text}"`
        );
      },
    },
    {
      id: 'dismiss-button-labeled',
      description: 'dismiss ボタンが非空ラベルを持つ',
      check: ({ root }) => {
        const btn = root.querySelector('button');
        const text = btn?.textContent?.trim() ?? '';
        return text.length > 0 || 'dismiss ボタンのラベルが空';
      },
    },
    {
      id: 'stays-mounted-after-dismiss',
      description: 'dismiss クリック後もモーダルは残る（クローズは親が所有）',
      onlyFixtures: ['dismiss-click'],
      check: ({ root }) =>
        Boolean(root.querySelector('[role="dialog"]')) ||
        '制御モーダルなのに孤立時に自己クローズしてしまった',
    },
  ],
});
