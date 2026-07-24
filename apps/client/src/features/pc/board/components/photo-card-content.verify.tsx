/**
 * PhotoCardContent の検証スペック（A 移植）。
 * ボードの写真カード本文（画像 + 任意キャプション）。props だけで孤立描画できる純表示部品。
 * caption の有無を data-verify-has-caption として公表し、
 * 「契約↔props」「キャプション <p> は has-caption=true のときだけ描画」
 * 「img の alt は caption（無ければ 'Board photo'）」を invariant で検証する。
 * caption='' は string 型の falsy-but-defined エッジで、alt フォールバックと
 * <p> 条件分岐の両方を突くため probe にする。i18n は使わないが、テンプレ規約に合わせ
 * withVerifyProviders で包む（コンテキスト不要・無害）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { PhotoCardContent } from './photo-card-content';

interface Props {
  content: {
    imageUrl: string;
    caption: string;
  };
}

const SAMPLE_IMAGE = 'https://example.com/board-photo.jpg';

registerUnit<Props>({
  id: 'PhotoCardContent',
  title: 'PhotoCardContent',
  description: 'ボードの写真カード本文（画像 + 任意キャプション）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<PhotoCardContent {...props} />),
  fixtures: [
    {
      id: 'with-caption',
      description: 'キャプションあり（画像 + キャプション文を表示）',
      props: { content: { imageUrl: SAMPLE_IMAGE, caption: '海辺の夕暮れ' } },
    },
    {
      id: 'empty-caption',
      probe: true,
      description:
        'Probe: caption が空文字でも崩れない（<p> は出ず、alt は Board photo にフォールバック）',
      props: { content: { imageUrl: SAMPLE_IMAGE, caption: '' } },
    },
  ],
  invariants: [
    {
      id: 'has-caption-contract-matches-props',
      description: 'data-verify-has-caption が Boolean(props.content.caption) と一致する',
      check: ({ contract, props }) =>
        contract.hasCaption === String(Boolean(props.content.caption)) ||
        `hasCaption 契約不一致: caption=${JSON.stringify(props.content.caption)} → contract.hasCaption=${contract.hasCaption}`,
    },
    {
      id: 'caption-present-iff-has-caption',
      description: 'キャプション <p> は has-caption=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasParagraph = Boolean(root.querySelector('p'));
        const expectCaption = contract.hasCaption === 'true';
        return (
          hasParagraph === expectCaption ||
          `<p> present=${hasParagraph} だが contract.hasCaption=${contract.hasCaption}`
        );
      },
    },
    {
      id: 'img-alt-reflects-caption',
      description: 'img の alt は caption（無ければ "Board photo"）',
      check: ({ root, props }) => {
        const img = root.querySelector('img');
        const expected = props.content.caption || 'Board photo';
        const actual = img?.getAttribute('alt');
        return actual === expected || `alt 不一致: expected="${expected}", got="${actual}"`;
      },
    },
  ],
});
