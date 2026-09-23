/**
 * InlineImageOverlay の検証スペック。
 *
 * この部品が持つのは**枠と 8 点**だけ。幅・寄せ・回り込み・外すはパレットへ移したので、
 * ここに操作の面は無い（本文に被る小さな面が画面の道具を 2 か所に割っていた）。
 *
 * 見張るのは 2 つ:
 *   - 8 点がそろっていて、名前が付いていること
 *   - 点が**箱の割合**（0% / 50% / 100%）で置かれていること。以前は端からの固定値と
 *     中心合わせの戻しが二重に効いて、8 点すべてが左上へ 4px ずれていた
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

/** 点が乗ってよい位置。箱の端か、真ん中だけ。 */
const ANCHORS = ['0%', '50%', '100%'];

registerUnit<Props>({
  id: 'InlineImageOverlay',
  title: 'InlineImageOverlay',
  description: '本文中の写真を選んだときに重なる枠と 8 点（操作はパレット側）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <InlineImageOverlay rect={RECT} image={props.image} onResizeStart={() => {}} />,
    ),
  fixtures: [
    { id: 'inline', description: '行内（既定）', props: { image: image() } },
    {
      id: 'block',
      description: 'ブロック配置',
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
      id: 'handles-sit-on-the-box',
      // 位置を px で持つと、丸の大きさや中心合わせと二重に効いてずれる（実際 4px ずれていた）。
      description: '点は箱の割合（0% / 50% / 100%）で置かれている',
      check: ({ root }) => {
        const off = Array.from(root.querySelectorAll<HTMLElement>('[data-handle]')).filter(
          (el) => !ANCHORS.includes(el.style.left) || !ANCHORS.includes(el.style.top),
        );
        if (off.length === 0) return true;
        const where = off
          .map((el) => `${el.getAttribute('data-handle')}(${el.style.left},${el.style.top})`)
          .join(' ');
        return `割合で置かれていない点がある: ${where}`;
      },
    },
    {
      id: 'no-controls-on-the-photo',
      // 操作はパレットに集める。ここに増やすと、道具が画面の 2 か所に割れる。
      description: '枠の上に操作ボタンを置かない（8 点だけ）',
      check: ({ root }) => {
        const extra = Array.from(root.querySelectorAll('button')).filter(
          (el) => !el.hasAttribute('data-handle'),
        );
        return (
          extra.length === 0 ||
          `8 点以外のボタンが ${extra.length} 個ある（操作はパレットへ）: ${extra
            .map((el) => el.textContent?.trim())
            .join(' / ')}`
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
