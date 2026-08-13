/**
 * BoardCard の検証スペック（A 移植）。
 * ボード上のカード（entry / snippet / photo）。状態はすべて props 由来で
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

const entryCard: BoardCardData = {
  id: 'card-entry-1',
  cardType: 'entry',
  refId: 'entry-1',
  x: 40,
  y: 40,
  rotation: 0,
  width: 220,
  height: 260,
  zIndex: 1,
  createdAt: '2026-06-20T10:00:00.000Z',
  content: {
    title: '朝のメモ',
    preview: '今日は早起きして散歩した。空気が澄んでいて気持ちがよかった。',
    createdAt: '2026-06-20T10:00:00.000Z',
  },
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
  createdAt: '2026-06-22T08:00:00.000Z',
  content: {
    imageUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=',
    caption: 'テスト写真',
  },
};

registerUnit<Props>({
  id: 'BoardCard',
  title: 'BoardCard',
  description: 'ボード上のカード（entry / snippet / photo）。選択時のみ操作ハンドルを出す。',
  kind: 'component',
  render: (props) => withVerifyProviders(<BoardCard {...props} />),
  fixtures: [
    {
      id: 'entry-unselected',
      description: 'エントリカード・未選択（ハンドルなし）',
      props: { card: entryCard, isSelected: false, isDragging: false, ...baseCallbacks },
    },
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
      id: 'selected-removing-dragging',
      probe: true,
      description:
        'Probe: 選択中かつ removing かつ dragging が同時に成立しても、ハンドルは描画され契約が破綻しない',
      props: {
        card: { ...entryCard, removing: true },
        isSelected: true,
        isDragging: true,
        ...baseCallbacks,
      },
    },
  ],
  invariants: [
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
