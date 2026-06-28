/**
 * StatsPopup の検証スペック（A 移植）。
 * props 完全制御のモーダル（open=true でのみ描画）。i18n は withVerifyProviders が供給。
 * 公表する契約は計算結果（charCount / lines / paragraphs）。
 * 注意: chars カードは toLocaleString() でカンマ整形されるため、DOM テキスト照合には
 * props.charCount.toLocaleString() を使い、契約の生値（String(charCount)）と混ぜない。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { StatsPopup } from './stats-popup';

interface Props {
  open: boolean;
  charCount: number;
  content: string;
  onClose: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'StatsPopup',
  title: 'StatsPopup',
  description: 'エディタの執筆統計モーダル（文字数・行数・段落数・読了時間）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<StatsPopup {...props} />),
  fixtures: [
    {
      id: 'short',
      description: '短文（読了時間は「1分未満」ブランチ）',
      props: {
        open: true,
        charCount: 120,
        content: '今日は良い一日だった。\n散歩に出かけた。',
        onClose: noop,
      },
    },
    {
      id: 'empty',
      description: '本文空（行数・段落数 0、1分未満）',
      props: { open: true, charCount: 0, content: '', onClose: noop },
    },
    {
      id: 'large',
      probe: true,
      description:
        'Probe: 大量文字（カンマ整形 "8,000" ＋ 読了時間が分ブランチに入る）でも崩れない',
      props: {
        open: true,
        charCount: 8000,
        content: Array.from({ length: 12 }, (_, i) => `段落${i} の本文です。`).join('\n\n'),
        onClose: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'charcount-contract-integrity',
      description: 'contract.charCount が props.charCount（生値）と一致する',
      check: ({ contract, props }) =>
        contract.charCount === String(props.charCount) ||
        `charCount 契約不一致: contract="${contract.charCount}", props=${props.charCount}`,
    },
    {
      id: 'charcount-rendered-localized',
      description: '文字数がカンマ整形（toLocaleString）で DOM に描画される',
      check: ({ root, props }) =>
        Boolean(root.textContent?.includes(props.charCount.toLocaleString())) ||
        `"${props.charCount.toLocaleString()}" が描画されていない`,
    },
    {
      id: 'lines-rendered',
      description: '契約の行数が DOM 上にそのまま（カンマなし）描画される',
      check: ({ root, contract }) =>
        Boolean(root.textContent?.includes(contract.lines)) ||
        `lines="${contract.lines}" が描画されていない`,
    },
    {
      id: 'reading-time-under-minute',
      description: '500字未満では「1分未満」が表示される',
      onlyFixtures: ['short', 'empty'],
      check: ({ root }) =>
        Boolean(root.textContent?.includes('1分未満')) || '「1分未満」が表示されていない',
    },
    {
      id: 'reading-time-minutes',
      description: '500字以上では「約N分」が表示される（1分未満ではない）',
      onlyFixtures: ['large'],
      check: ({ root, props }) => {
        const expected = `約${Math.ceil(props.charCount / 500)}分`;
        return (
          (Boolean(root.textContent?.includes(expected)) &&
            !root.textContent?.includes('1分未満')) ||
          `読了時間が "${expected}" になっていない`
        );
      },
    },
  ],
});
