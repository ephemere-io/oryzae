/**
 * InlineImageOverlay の検証スペック。
 *
 * 本文（contentEditable）そのものは孤立検証に載らないが、この部品は
 * 「選択中の写真の設定 → 出す操作 UI」の純粋な写像なので単体で検証できる。
 *
 * ここで固定したいのは **操作の数を増やさないこと**。以前は回り込みと寄せを選ばせて
 * いたが「項目が多く、全部試さないと意味が分からない」という指摘で畳んだ経緯がある。
 * 操作はサイズ（8 ハンドル）・回転・削除の 3 つだけ。
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
  return { offset: 0, storagePath: 'u1/1-photo.jpg', widthRatio: 0.8, ...over };
}

registerUnit<Props>({
  id: 'InlineImageOverlay',
  title: 'InlineImageOverlay',
  description: '本文中の写真を選んだときに重なる操作 UI（8 ハンドル + 回転 + 削除）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <InlineImageOverlay
        rect={RECT}
        image={props.image}
        onResizeStart={() => {}}
        onRotateStart={() => {}}
        onRemove={() => {}}
      />,
    ),
  fixtures: [
    { id: 'default', description: '既定（長辺が行に沿う写真の 80%）', props: { image: image() } },
    {
      id: 'narrow',
      description: '長辺が行と直交する写真（50%）',
      props: { image: image({ widthRatio: 0.5 }) },
    },
    {
      id: 'rotated',
      probe: true,
      description: 'Probe: 傾けた写真',
      props: { image: image({ rotation: -8 }) },
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
      description: 'リサイズハンドルが常に 8 個ある（角 4 + 辺 4）',
      check: ({ root }) => {
        const n = root.querySelectorAll('[data-handle]').length;
        return n === 8 || `ハンドルが 8 個ではない: ${n}`;
      },
    },
    {
      id: 'no-layout-choices',
      description: '配置を選ばせない（操作はサイズ・回転・削除だけ）',
      check: ({ root }) => {
        // 選択式の操作が復活すると aria-pressed 付きのボタンが現れる。
        const toggles = root.querySelectorAll('[aria-pressed]').length;
        return toggles === 0 || `配置の選択肢が ${toggles} 個ある（畳んだはず）`;
      },
    },
    {
      id: 'remove-and-rotate-present',
      description: '削除（右上のバツ）と回転がある',
      check: ({ root }) =>
        Boolean(
          root.querySelector('[data-testid="inline-image-remove"]') &&
            root.querySelector('[data-testid="inline-image-rotate"]'),
        ) || '削除または回転のハンドルが無い',
    },
    {
      id: 'contract-matches-props',
      description: '公表する契約が渡された設定と一致する',
      check: ({ contract, props }) =>
        (contract.widthRatio === String(props.image.widthRatio) &&
          contract.rotation === String(props.image.rotation ?? 0)) ||
        `契約不一致: widthRatio=${contract.widthRatio} rotation=${contract.rotation}`,
    },
    {
      id: 'controls-are-labelled',
      description: '掴む対象すべてに説明がある（アイコンだけの当たり判定にしない）',
      check: ({ root }) => {
        const unlabelled = Array.from(root.querySelectorAll('button')).filter(
          (el) => !el.getAttribute('aria-label'),
        );
        return unlabelled.length === 0 || `ラベルの無い操作が ${unlabelled.length} 個`;
      },
    },
  ],
});
