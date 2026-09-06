/**
 * BoardCard の検証スペック（A 移植）。
 * ボード上のカード（snippet / photo）。状態はすべて props 由来で
 * useState を持たない純表示部品のため、act ではなく prop 駆動の fixture で検証する。
 * 選択時のみハンドル（削除ボタン・回転スライダー）が出ることを契約↔DOM 一致で確認。
 * getBoundingClientRect は回転ハンドルの onPointerDown 内のみで描画経路に無いため
 * jsdom でも静的マウントは安全（回転を発火する fixture は書かない）。
 */

import { registerUnit } from '@oryzae/verify';
import type { BoardCardData } from '@/features/shared/board/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BoardCard } from './board-card';

interface Props {
  card: BoardCardData;
  detail?: 'block' | 'title' | 'full';
  isSelected: boolean;
  isDragging: boolean;
  onPointerDown: (cardId: string, x: number, y: number) => void;
  onRotateStart: (
    cardId: string,
    centerX: number,
    centerY: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  onResizeStart: (cardId: string, corner: 'se' | 'sw' | 'ne' | 'nw', x: number, y: number) => void;
  onDelete: (cardId: string) => void;
  onClick: (card: BoardCardData) => void;
}

const noop = () => {};

const baseCallbacks = {
  onPointerDown: noop,
  onRotateStart: noop,
  onResizeStart: noop,
  onDelete: noop,
  onClick: noop,
};

const snippetCard: BoardCardData = {
  id: 'card-snippet-1',
  cardType: 'snippet',
  refId: 'snippet-1',
  x: 120,
  y: 80,
  rotation: -6,
  width: 180,
  height: 140,
  zIndex: 2,
  userPositioned: false,
  createdAt: '2026-06-21T09:00:00.000Z',
  content: { text: '走り書きのアイデア。' },
};

const photoCard: BoardCardData = {
  id: 'card-photo-1',
  cardType: 'photo',
  refId: 'photo-1',
  x: 200,
  y: 60,
  rotation: 12,
  width: 200,
  height: 200,
  zIndex: 3,
  userPositioned: false,
  createdAt: '2026-06-22T08:00:00.000Z',
  content: {
    imageUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=',
    caption: 'テスト写真',
  },
};

registerUnit<Props>({
  id: 'BoardCard',
  title: 'BoardCard',
  description: 'ボード上のカード（snippet / photo）。選択時のみ操作ハンドルを出す。',
  kind: 'component',
  render: (props) => withVerifyProviders(<BoardCard {...props} />),
  fixtures: [
    {
      id: 'snippet-unselected',
      description: 'スニペットカード・未選択',
      props: { card: snippetCard, isSelected: false, isDragging: false, ...baseCallbacks },
    },
    {
      id: 'photo-selected',
      description: '写真カード・選択中（ハンドル表示・回転 +12deg）',
      props: { card: photoCard, isSelected: true, isDragging: false, ...baseCallbacks },
    },
    {
      id: 'photo-block-detail',
      probe: true,
      description: 'Probe: 引ききった表示(block)でも写真の img は残る（白い矩形にしない）',
      props: {
        card: photoCard,
        detail: 'block',
        isSelected: false,
        isDragging: false,
        ...baseCallbacks,
      },
    },
    {
      id: 'snippet-block-detail',
      description: '引ききった表示(block)のスニペット（本文の代わりに行の図）',
      props: {
        card: snippetCard,
        detail: 'block',
        isSelected: false,
        isDragging: false,
        ...baseCallbacks,
      },
    },
    {
      id: 'snippet-title-detail',
      probe: true,
      description:
        'Probe: すれ違いの帯(title)では図と文字が両方 DOM に居る（不透明度 0 で入れ替わるため）',
      props: {
        card: snippetCard,
        detail: 'title',
        isSelected: false,
        isDragging: false,
        ...baseCallbacks,
      },
    },
    {
      id: 'photo-title-detail',
      probe: true,
      description: 'Probe: 写真は帯の中でも図に置き換わらない（縮んでも何の写真か分かるため）',
      props: {
        card: photoCard,
        detail: 'title',
        isSelected: false,
        isDragging: false,
        ...baseCallbacks,
      },
    },
    {
      id: 'selected-removing-dragging',
      probe: true,
      description:
        'Probe: 選択中かつ removing かつ dragging が同時に成立しても、ハンドルは描画され契約が破綻しない',
      props: {
        card: { ...snippetCard, removing: true },
        isSelected: true,
        isDragging: true,
        ...baseCallbacks,
      },
    },
  ],
  invariants: [
    {
      id: 'text-layers-overlap-in-the-fade-band',
      description:
        'スニペットの図と文字の出方が簡略度と一致する（block=図だけ / title=両方 / full=文字だけ）',
      check: ({ root, contract, props }) => {
        // 写真は文字を持たないので入れ替えの対象外（どの倍率でも img のまま）。
        if (props.card.cardType !== 'snippet') return true;
        const glyph = Boolean(root.querySelector('[data-verify-part="glyph-layer"]'));
        const text = Boolean(root.querySelector('[data-verify-part="text-layer"]'));
        const detail = contract.detail;
        // 帯(title)で片方しか居ないと、入れ替えが不透明度 0 の外で起きて段差になる。
        const expected =
          detail === 'block'
            ? { glyph: true, text: false }
            : detail === 'full'
              ? { glyph: false, text: true }
              : { glyph: true, text: true };
        return (
          (glyph === expected.glyph && text === expected.text) ||
          `detail="${detail}" では 図=${expected.glyph} 文字=${expected.text} を期待したが、図=${glyph} 文字=${text}`
        );
      },
    },
    {
      id: 'fade-layers-are-stacked',
      description: '図と文字は同じ場所に重なる（inset-0）。ずれると帯の中で二重に見える',
      check: ({ root }) => {
        const layers = Array.from(
          root.querySelectorAll(
            '[data-verify-part="glyph-layer"], [data-verify-part="text-layer"]',
          ),
        );
        if (layers.length === 0) return true;
        const bad = layers.filter((el) => !el.className.includes('inset-0'));
        return (
          bad.length === 0 ||
          `重ね合わせでない層が ${bad.length} 枚ある: ${bad.map((b) => b.getAttribute('data-verify-part')).join(', ')}`
        );
      },
    },
    {
      id: 'photo-img-always-rendered',
      description: 'どの詳細度でも写真カードは img を描く（文字だけを落とす）',
      check: ({ root, props }) => {
        if (props.card.cardType !== 'photo') return true;
        return (
          Boolean(root.querySelector('img')) ||
          `写真カードなのに img が無い（detail=${props.detail ?? 'full'}）`
        );
      },
    },
    {
      id: 'cardtype-contract-matches-props',
      description: 'data-verify-card-type が props.card.cardType と一致する',
      check: ({ contract, props }) =>
        contract.cardType === props.card.cardType ||
        `cardType 契約不一致: props=${props.card.cardType} → contract.cardType=${contract.cardType}`,
    },
    {
      id: 'selected-contract-matches-props',
      description: 'data-verify-selected が props.isSelected と一致する',
      check: ({ contract, props }) =>
        contract.selected === String(props.isSelected) ||
        `selected 契約不一致: props.isSelected=${props.isSelected} → contract.selected=${contract.selected}`,
    },
    {
      id: 'handles-present-iff-selected',
      description: '削除ボタンと回転スライダーは selected=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasDelete = Boolean(root.querySelector('[aria-label="Delete card"]'));
        const hasRotate = Boolean(root.querySelector('[role="slider"]'));
        const expectSelected = contract.selected === 'true';
        const handlesPresent = hasDelete && hasRotate;
        return (
          handlesPresent === expectSelected ||
          `ハンドル present=${handlesPresent}（delete=${hasDelete}, rotate=${hasRotate}）だが contract.selected="${contract.selected}"`
        );
      },
    },
    {
      id: 'slider-valuenow-matches-rotation',
      description: '選択時、回転スライダーの aria-valuenow が card.rotation と一致する',
      onlyFixtures: ['photo-selected'],
      check: ({ root, props }) => {
        const slider = root.querySelector('[role="slider"]');
        const valuenow = slider?.getAttribute('aria-valuenow');
        return (
          valuenow === String(props.card.rotation) ||
          `aria-valuenow="${valuenow}" だが card.rotation=${props.card.rotation}`
        );
      },
    },
  ],
});
