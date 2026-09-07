/**
 * InlineImageOverlay の検証スペック。
 *
 * 本文（contentEditable）そのものは孤立検証に載らないが、この部品は
 * 「選択中の写真の設定 → 出す操作 UI」の純粋な写像なので単体で検証できる。
 *
 * 見張るのは **道具を増やさないこと**。以前はここに「行内 / ブロック / 回り込み」×
 * 「先頭 / 中央 / 末尾」の6つが並び、全部試さないと意味が分からなかった。
 * いま出せるのは「大きさを変える」「消す」の2つだけで、位置は本文の中で掴んで動かす。
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
    widthRatio: 0.5,
    layout: 'block',
    align: 'center',
    ...over,
  };
}

registerUnit<Props>({
  id: 'InlineImageOverlay',
  title: 'InlineImageOverlay',
  description: '本文中の写真を選んだときに重なる操作 UI（8 ハンドル + 削除）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <InlineImageOverlay
        rect={RECT}
        image={props.image}
        onResizeStart={() => {}}
        onRemove={() => {}}
      />,
    ),
  fixtures: [
    { id: 'block-center', description: '独立した行の中央（既定）', props: { image: image() } },
    {
      id: 'wide',
      description: '行と同じ向きの写真（行の 80%）',
      props: { image: image({ widthRatio: 0.8 }) },
    },
    {
      id: 'legacy-wrap',
      probe: true,
      description: 'Probe: 以前の記録に残る回り込み。読めるが、道具は増えない',
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
      id: 'no-layout-choices',
      // 「全部試さないと意味が分からない」が起きたのはここ。**選ばせない**ことで直した。
      // 以前の記録（wrap）を開いても道具が増えないことも、同じ規則で見張る。
      description: '回り込みや寄せを選ぶ道具は出さない（写真は独立した行の中央に置く）',
      check: ({ root }) => {
        const pressable = root.querySelectorAll('[aria-pressed]').length;
        return pressable === 0 || `選択ボタンが ${pressable} 個残っている`;
      },
    },
    {
      id: 'only-resize-and-remove',
      description: '押せるものは、8 つのハンドルと削除だけ',
      check: ({ root }) => {
        const buttons = root.querySelectorAll('button').length;
        return buttons === 9 || `ボタンが ${buttons} 個（ハンドル8 + 削除1 のはず）`;
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
