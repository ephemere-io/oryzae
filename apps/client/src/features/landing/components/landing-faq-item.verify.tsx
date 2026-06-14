/**
 * 実 feature への検証ハーネス適用（PoC 第1号）。
 * LandingFaqItem は開閉状態を持つアコーディオン。状態を data-verify-open として公表し、
 * 「aria-expanded と契約の一致」「クリックで開く」を invariant＋act で検証する。
 */

import { registerUnit } from '@oryzae/verify';
import { LandingFaqItem } from './landing-faq-item';

interface LandingFaqItemProps {
  question: string;
  answer: string;
}

registerUnit<LandingFaqItemProps>({
  id: 'LandingFaqItem',
  title: 'LandingFaqItem',
  description: 'ランディングのFAQアコーディオン項目（開閉状態を持つ）。',
  kind: 'component',
  render: (props) => <LandingFaqItem {...props} />,
  fixtures: [
    {
      id: 'collapsed',
      description: '初期状態（閉じている）',
      props: { question: 'サービスは無料ですか？', answer: 'はい、無料で始められます。' },
    },
    {
      id: 'expanded',
      description: 'クリックして開く',
      props: { question: 'サービスは無料ですか？', answer: 'はい、無料で始められます。' },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
    {
      id: 'long-answer',
      probe: true,
      description: 'Probe: 非常に長い回答でもレイアウトが崩れない（初期は閉じている）',
      props: { question: 'Q?', answer: 'あ'.repeat(2000) },
    },
  ],
  invariants: [
    {
      id: 'aria-expanded-matches-contract',
      description: 'button[aria-expanded] が data-verify-open と一致する',
      check: ({ root, contract }) => {
        const btn = root.querySelector('button');
        const expanded = btn?.getAttribute('aria-expanded');
        return (
          expanded === contract.open ||
          `aria-expanded="${expanded}", contract.open="${contract.open}"`
        );
      },
    },
    {
      id: 'question-rendered',
      description: '質問文が表示される',
      check: ({ root, props }) =>
        Boolean(root.textContent?.includes(props.question)) ||
        `question "${props.question}" not rendered`,
    },
    {
      id: 'default-collapsed',
      description: '初期状態は閉じている（open=false）',
      onlyFixtures: ['collapsed'],
      check: ({ contract }) =>
        contract.open === 'false' || `expected open=false, got "${contract.open}"`,
    },
    {
      id: 'expands-on-click',
      description: 'クリック後は開いている（open=true）',
      onlyFixtures: ['expanded'],
      check: ({ contract }) =>
        contract.open === 'true' || `expected open=true after click, got "${contract.open}"`,
    },
  ],
});
