/**
 * SnippetCardContent の検証スペック（A 移植）。
 * props（content.text）だけで孤立描画できる純表示部品。i18n も router も使わないが、
 * 土台を揃えるため withVerifyProviders で包む。本文の長さを契約として公表し、
 * 「契約↔props の長さ一致」「本文が <p> に描画される」を検証する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SnippetCardContent } from './snippet-card-content';

interface Props {
  content: { text: string };
}

registerUnit<Props>({
  id: 'SnippetCardContent',
  title: 'SnippetCardContent',
  description: 'ボードのスニペットカード本文（ラベル + テキスト表示）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SnippetCardContent {...props} />),
  fixtures: [
    {
      id: 'short',
      description: '通常の短いスニペット',
      props: { content: { text: '今日は朝から集中できた。' } },
    },
    {
      id: 'long',
      probe: true,
      description: 'Probe: 非常に長い本文でもレイアウトが崩れず全文が描画される',
      props: {
        content: {
          text: 'これはとても長いスニペットの本文です。'.repeat(40),
        },
      },
    },
  ],
  invariants: [
    {
      id: 'textlen-contract-matches-props',
      description: 'data-verify-text-len が props.content.text.length と一致する',
      check: ({ contract, props }) =>
        contract.textLen === String(props.content.text.length) ||
        `textLen 契約不一致: props=${props.content.text.length} → contract.textLen=${contract.textLen}`,
    },
    {
      id: 'text-rendered',
      description: '本文テキストが <p> に描画される',
      check: ({ root, props }) => {
        const unit = root.querySelector('[data-verify-unit="SnippetCardContent"]');
        const paragraph = unit?.querySelector('p');
        return (
          Boolean(paragraph?.textContent?.includes(props.content.text)) ||
          `本文が描画されていない: 期待="${props.content.text.slice(0, 20)}…"`
        );
      },
    },
    {
      id: 'empty-flag-matches-len',
      description: 'data-verify-empty は textLen===0 と一致する（空判定の整合）',
      check: ({ contract }) =>
        contract.empty === String(contract.textLen === '0') ||
        `empty 契約不一致: textLen=${contract.textLen} → empty=${contract.empty}`,
    },
  ],
});
