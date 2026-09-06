/**
 * InlineImageOverlay の検証スペック。
 *
 * 本文（contentEditable）そのものは孤立検証に載らないが、この部品は
 * 「選択中の写真の設定 → 出す操作 UI」の純粋な写像なので単体で検証できる。
 * 特に **寄せは行内では出さない**（文字の流れが位置を決めるため意味を持たない）という
 * 分岐を、Word のレイアウトオプションに倣った仕様として固定しておく。
 */

import type { InlineImage } from '@oryzae/shared';
import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { InlineImageOverlay } from './inline-image-overlay';

interface Props {
  image: InlineImage;
}

/**
 * 画面座標は検証に関係しないので固定値で置く。
 * DOMRect はテスト環境によっては未定義なので、素のオブジェクトで代用する
 * （この部品は left/top/width/height しか読まない）。
 */
const RECT: DOMRect = {
  x: 100,
  y: 80,
  width: 240,
  height: 180,
  left: 100,
  top: 80,
  right: 340,
  bottom: 260,
  toJSON: () => ({}),
};

function image(over: Partial<InlineImage> = {}): InlineImage {
  return {
    offset: 0,
    storagePath: 'u1/1-photo.jpg',
    widthRatio: 0.4,
    layout: 'inline',
    align: 'start',
    ...over,
  };
}

registerUnit<Props>({
  id: 'InlineImageOverlay',
  title: 'InlineImageOverlay',
  description: '本文中の写真を選んだときに重なる操作 UI（8 ハンドル + レイアウト切替）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <InlineImageOverlay
        rect={RECT}
        image={props.image}
        onResizeStart={() => {}}
        onLayoutChange={() => {}}
        onRemove={() => {}}
      />,
    ),
  fixtures: [
    { id: 'inline', description: '行内（既定）', props: { image: image() } },
    {
      id: 'block',
      description: 'ブロック配置。寄せが選べる',
      props: { image: image({ layout: 'block', align: 'center' }) },
    },
    {
      id: 'wrap',
      probe: true,
      description: 'Probe: 回り込み + 終わり寄せ',
      props: { image: image({ layout: 'wrap', align: 'end', widthRatio: 0.75 }) },
    },
    {
      id: 'tiny',
      probe: true,
      description: 'Probe: 最小幅でもハンドルが 8 個そろう',
      props: { image: image({ widthRatio: 0.05 }) },
    },
  ],
  invariants: [
    {
      id: 'eight-handles',
      description: 'リサイズハンドルが常に 8 個ある（Word と同じ角 4 + 辺 4）',
      check: ({ root }) => {
        const n = root.querySelectorAll('[data-handle]').length;
        return n === 8 || `ハンドルが 8 個ではない: ${n}`;
      },
    },
    {
      id: 'align-only-when-meaningful',
      description: '寄せは行内では出さず、ブロック / 回り込みでだけ出す',
      check: ({ root, props }) => {
        // aria-pressed を持つボタンのうち、レイアウト 3 種を除いたものが寄せ。
        const pressable = root.querySelectorAll('[aria-pressed]').length;
        const expected = props.image.layout === 'inline' ? 3 : 6;
        return (
          pressable === expected ||
          `layout=${props.image.layout} のとき選択ボタンは ${expected} 個のはずが ${pressable} 個`
        );
      },
    },
    {
      id: 'contract-matches-props',
      description: '公表する契約が渡された設定と一致する',
      check: ({ contract, props }) =>
        (contract.layout === props.image.layout && contract.align === props.image.align) ||
        `契約不一致: layout=${contract.layout} align=${contract.align}`,
    },
    {
      id: 'handles-are-labelled',
      description: '各ハンドルに説明がある（アイコンだけの当たり判定にしない）',
      check: ({ root }) => {
        const unlabelled = Array.from(root.querySelectorAll('[data-handle]')).filter(
          (el) => !el.getAttribute('aria-label'),
        );
        return unlabelled.length === 0 || `ラベルの無いハンドルが ${unlabelled.length} 個`;
      },
    },
  ],
});
