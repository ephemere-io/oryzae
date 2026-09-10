/**
 * SpBoardSurface の検証スペック。
 *
 * 受け入れ基準（40-acceptance.md「SP のタッチ提示」）が具体的なので、そこを機械的に見る:
 * 右ペインが無い / 日付とカード枚数だけが隅にある / つかんでいる間は最前面へ。
 */

import { registerUnit } from '@oryzae/verify';
import type { BoardCardData } from '@/features/shared/board/types';
import { IDENTITY_VIEWPORT, type Viewport } from '@/lib/canvas/viewport';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpBoardSurface } from './sp-board-surface';

interface Props {
  cards: BoardCardData[];
  dateKey: string;
  viewport: Viewport;
  onMove: (cardId: string, x: number, y: number) => void;
  onCommit: () => void;
  selectedId?: string | null;
  onSelect?: (cardId: string | null) => void;
  onTransform?: (cardId: string, next: { rotation: number; width: number; height: number }) => void;
}

function snippet(id: string, x: number, y: number, text: string): BoardCardData {
  return {
    id,
    cardType: 'snippet',
    refId: `s-${id}`,
    x,
    y,
    rotation: -2,
    width: 262,
    height: 120,
    zIndex: 1,
    userPositioned: false,
    createdAt: '2026-09-04T01:00:00.000Z',
    content: { text },
  };
}

const CARDS: BoardCardData[] = [
  snippet('c1', 40, 60, '窓の外がずっと白かった。'),
  snippet('c2', 150, 240, '同じ道を選ばなかった日のこと。'),
  { ...snippet('c3', 60, 420, ''), zIndex: 2 },
];

const NOOP = { onMove: () => {}, onCommit: () => {} };

registerUnit<Props>({
  id: 'SpBoardSurface',
  title: 'SpBoardSurface',
  description: 'SP のボード（右ペイン無し・指でカードを動かす）',
  kind: 'component',
  // 盤面は h-full で親に従うので、器の大きさを決めないと live mount が潰れて何も見えない。
  // iPhone の縦画面（390×560 ≒ 上下の余白を除いた分）を器にする。
  render: (props) =>
    withVerifyProviders(
      <div style={{ width: '390px', height: '560px', position: 'relative' }}>
        <SpBoardSurface {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'cards',
      description: 'カードが3枚',
      props: { cards: CARDS, dateKey: '2026-09-04', viewport: IDENTITY_VIEWPORT, ...NOOP },
    },
    {
      id: 'fitted',
      probe: true,
      description: 'Probe: 縮小して盤面全体を収めた状態',
      props: {
        cards: CARDS,
        dateKey: '2026-09-04',
        viewport: { x: 12, y: 20, scale: 0.55 },
        ...NOOP,
      },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: カードが無い日は空の盤面ではなく文言を出す',
      props: { cards: [], dateKey: '2026-09-04', viewport: IDENTITY_VIEWPORT, ...NOOP },
    },
    {
      id: 'selected',
      probe: true,
      description: 'Probe: 選んだカードには枠と、角のつまみが出る',
      props: {
        cards: CARDS,
        dateKey: '2026-09-04',
        viewport: IDENTITY_VIEWPORT,
        selectedId: CARDS[0].id,
        onSelect: () => {},
        onTransform: () => {},
        ...NOOP,
      },
    },
    {
      id: 'selected-scaled',
      probe: true,
      description: 'Probe: 縮小してもつまみは指で掴める大きさのまま（逆スケール）',
      props: {
        cards: CARDS,
        dateKey: '2026-09-04',
        viewport: { x: 12, y: 20, scale: 0.4 },
        selectedId: CARDS[0].id,
        onSelect: () => {},
        onTransform: () => {},
        ...NOOP,
      },
    },
  ],
  invariants: [
    {
      id: 'handle-only-when-selected',
      description: 'つまみは選んでいるときだけ出す（常設だと板が点だらけになる）',
      check: ({ root, props }) => {
        const handles = root.querySelectorAll('[data-testid="sp-board-handle"]').length;
        const expected = props.selectedId != null && props.onTransform !== undefined ? 1 : 0;
        return handles === expected || `つまみ ${handles} 個（期待: ${expected}）`;
      },
    },
    {
      id: 'handle-keeps-finger-size',
      description: 'つまみは盤面の倍率によらず、画面上で同じ大きさになる',
      onlyFixtures: ['selected', 'selected-scaled'],
      check: ({ root, props }) => {
        const handle = root.querySelector('[data-testid="sp-board-handle"]');
        if (!(handle instanceof HTMLElement)) return 'つまみが無い';
        // world 上の寸法 × 倍率 ＝ 画面上の寸法。逆スケールしていれば一定になる。
        const onScreen = Number.parseFloat(handle.style.width) * props.viewport.scale;
        return (
          Math.abs(onScreen - 28) < 0.5 || `画面上のつまみが ${onScreen.toFixed(1)}px（期待: 28px）`
        );
      },
    },
    {
      id: 'no-side-pane',
      description: '右ペインを置かない（縦画面で板が潰れる）',
      check: ({ contract }) => contract.hasSidePane === 'false' || '右ペインを持つ契約になっている',
    },
    {
      id: 'card-count-matches',
      description: '描かれるカード数が渡した枚数と一致する',
      check: ({ root, props }) => {
        const rendered = root.querySelectorAll('[data-card-id]').length;
        const expected = props.cards.filter((c) => !c.removing).length;
        return rendered === expected || `枚数不一致: expected=${expected} actual=${rendered}`;
      },
    },
    {
      id: 'corner-shows-date-and-count',
      description: '隅に日付とカード枚数が出る',
      check: ({ root, props, contract }) => {
        const text = root.textContent ?? '';
        const [, month, day] = props.dateKey.split('-');
        if (!text.includes(`${month}.${day}`)) return '日付が出ていない';
        return text.includes(contract.cardCount ?? '') || '枚数が出ていない';
      },
    },
    {
      id: 'cards-are-touch-draggable',
      description: 'カードが touch-action: none を持つ（指の操作が移動に使われる）',
      check: ({ root }) => {
        for (const card of root.querySelectorAll('[data-card-id]')) {
          if (!(card instanceof HTMLElement)) continue;
          if (card.style.touchAction !== 'none') {
            return `touch-action が ${card.style.touchAction || '未設定'}`;
          }
        }
        return true;
      },
    },
    {
      id: 'empty-day-has-message',
      description: 'カードが 0 枚なら文言を出す',
      check: ({ root, contract }) => {
        if (contract.cardCount !== '0') return true;
        return Boolean(root.querySelector('p')) || '空の日に文言が出ていない';
      },
    },
    {
      id: 'not-dragging-at-rest',
      description: '触っていない間はどのカードも最前面に上がっていない',
      check: ({ root, contract }) => {
        if (contract.dragging !== 'false') return true;
        for (const card of root.querySelectorAll('[data-card-id]')) {
          if (!(card instanceof HTMLElement)) continue;
          if (Number(card.style.zIndex) >= 1000) return '掴んでいないのに最前面のカードがある';
        }
        return true;
      },
    },
  ],
});
