/**
 * PickleNudgeModal の検証スペック。
 * i18n 依存の表示部品を withVerifyProviders（NextIntlClientProvider）で孤立検証する。
 *
 * 注意: open は「props で制御される（controlled）」。LandingFaqItem のように自前で state を
 * 持たないため、dismiss クリックで onClose は発火しても孤立レンダリング中は open=true のまま
 * （親が居ないので state が flip しない）。さらに open=false は null を返し DOM 契約が消える＝
 * dom-contract verifier が FAIL する。よって全 fixture を open=true でマウントし、probe は
 * 「dismiss を押しても controlled なモーダルが消えない」ことを敵対的に確認する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { PickleNudgeModal } from './pickle-nudge-modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'PickleNudgeModal',
  title: 'PickleNudgeModal',
  description: '漬け込みボタンを未使用の人へ試用を促す案内モーダル（Issue #316）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<PickleNudgeModal {...props} />),
  fixtures: [
    {
      id: 'open',
      description: '開いている（案内を表示）',
      props: { open: true, onClose: noop },
    },
    {
      id: 'dismiss-click',
      probe: true,
      description:
        'Probe: dismiss を押しても controlled な open は flip しない（孤立レンダリングではモーダルは残る）',
      props: { open: true, onClose: noop },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'is-modal-dialog',
      description: 'role="dialog" かつ aria-modal="true" のモーダルである',
      check: ({ root }) => {
        const dialog = root.querySelector('[role="dialog"]');
        const ariaModal = dialog?.getAttribute('aria-modal');
        return (
          (dialog !== null && ariaModal === 'true') ||
          `dialog=${dialog !== null}, aria-modal="${ariaModal}"`
        );
      },
    },
    {
      id: 'open-contract-true',
      description: 'open=true でマウントしているので contract.open は "true"',
      check: ({ contract }) =>
        contract.open === 'true' || `expected contract.open="true", got "${contract.open}"`,
    },
    {
      id: 'dismiss-button-present',
      description: 'dismiss できる button が存在する',
      check: ({ root }) => root.querySelector('button') !== null || 'dismiss button not found',
    },
    {
      id: 'i18n-heading-resolved',
      description: '見出し(h3)が i18n で解決され、空でも生のキー名でもない',
      check: ({ root }) => {
        const heading = root.querySelector('h3')?.textContent?.trim() ?? '';
        return (
          (heading.length > 0 && heading !== 'heading') ||
          `heading が未解決: "${heading}"（withVerifyProviders が翻訳を供給していない可能性）`
        );
      },
    },
    {
      id: 'still-present-after-dismiss',
      description:
        'controlled: dismiss クリック後もモーダルは残る（open は props 由来で flip しない）',
      onlyFixtures: ['dismiss-click'],
      check: ({ root, contract }) =>
        (root.querySelector('[role="dialog"]') !== null && contract.open === 'true') ||
        `dismiss 後にモーダルが消えた（controlled の前提が崩れている）: open="${contract.open}"`,
    },
  ],
});
