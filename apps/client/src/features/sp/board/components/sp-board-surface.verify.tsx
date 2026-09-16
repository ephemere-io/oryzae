/**
 * SpBoardSurface の検証スペック。
 *
 * 受け入れ基準（40-acceptance.md「SP のタッチ提示」）が具体的なので、そこを機械的に見る:
 * 右ペインが無い / カード枚数だけが隅にある / つかんでいる間は最前面へ。
 *
 * 盤面のパン・ピンチは `useCanvasViewport`（PC のボードと同じ）が持つので、ここでは
 * hook を実際に張った容れ物で描く。ネットワークもデータ取得も無い純粋な部品のまま。
 */

import { registerUnit } from '@oryzae/verify';
import { snippetFontSize } from '@/features/shared/board/card-text';
import type { BoardCardData } from '@/features/shared/board/types';
import { useCanvasViewport } from '@/lib/canvas/use-canvas-viewport';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpBoardSurface } from './sp-board-surface';

interface Props {
  cards: BoardCardData[];
  selectedId?: string | null;
  onSelect?: (cardId: string | null) => void;
  onRaise?: (cardId: string) => void;
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

const WIDE: BoardCardData[] = [
  { ...snippet('wide', 40, 60, '枠を広げたカード。文字も大きくなる。'), width: 524, height: 240 },
];

/** 盤面（パン・ズーム）を張ってから部品を描く容れ物。 */
function SurfaceWithCanvas(props: Props) {
  const canvas = useCanvasViewport();
  return <SpBoardSurface {...props} canvas={canvas} onMove={() => {}} onCommit={() => {}} />;
}

registerUnit<Props>({
  id: 'SpBoardSurface',
  title: 'SpBoardSurface',
  description: 'SP のボード（右ペイン無し・指でカードを動かす・2 本指で寄り引き）',
  kind: 'component',
  // 盤面は h-full で親に従うので、器の大きさを決めないと live mount が潰れて何も見えない。
  // iPhone の縦画面（390×560 ≒ 上下の余白を除いた分）を器にする。
  render: (props) =>
    withVerifyProviders(
      <div style={{ width: '390px', height: '560px', position: 'relative' }}>
        <SurfaceWithCanvas {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'cards',
      description: 'カードが3枚',
      props: { cards: CARDS },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: カードが無いときは空の盤面ではなく文言を出す',
      props: { cards: [] },
    },
    {
      id: 'selected',
      probe: true,
      description: 'Probe: 選んだカードには枠と、角のつまみが出る',
      props: {
        cards: CARDS,
        selectedId: CARDS[0].id,
        onSelect: () => {},
        onTransform: () => {},
      },
    },
    {
      id: 'wide-card',
      probe: true,
      description: 'Probe: 枠を広げたカードは本文の文字も大きい（引いても読める）',
      props: { cards: WIDE },
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
      description: 'つまみの大きさは盤面の倍率で割り戻してある（指に対して一定に保つ）',
      onlyFixtures: ['selected'],
      check: ({ root }) => {
        const handle = root.querySelector('[data-testid="sp-board-handle"]');
        if (!(handle instanceof HTMLElement)) return 'つまみが無い';
        // world に置いた要素なので、CSS 側で `--vp-scale` で割らないと倍率ごと拡縮される。
        return (
          handle.style.width.includes('--vp-scale') ||
          `つまみの幅が倍率に追随していない: ${handle.style.width}`
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
      id: 'snippet-font-follows-card-width',
      description: '本文の文字の大きさがカードの幅に追随する（枠を広げたら読みやすくなる）',
      check: ({ root, props }) => {
        for (const card of props.cards) {
          if (card.cardType !== 'snippet') continue;
          const paragraph = root.querySelector(`[data-card-id="${card.id}"] p`);
          if (!(paragraph instanceof HTMLElement)) continue;
          const expected = `${snippetFontSize(card.width, 17)}px`;
          if (paragraph.style.fontSize !== expected) {
            return `幅 ${card.width} の本文が ${paragraph.style.fontSize}（期待: ${expected}）`;
          }
        }
        return true;
      },
    },
    {
      id: 'corner-shows-count',
      description: '隅にカード枚数が出る',
      check: ({ root, contract }) => {
        const text = root.textContent ?? '';
        return text.includes(contract.cardCount ?? '') || '枚数が出ていない';
      },
    },
    {
      id: 'cards-take-the-finger',
      description: 'カードは指の操作を受け、盤面のパンを辞退する（掴んだらカードが動く）',
      check: ({ root }) => {
        for (const card of root.querySelectorAll('[data-card-id]')) {
          if (!(card instanceof HTMLElement)) continue;
          if (card.style.touchAction !== 'none') {
            return `touch-action が ${card.style.touchAction || '未設定'}`;
          }
          if (!card.hasAttribute('data-canvas-no-pan')) {
            return 'カードが data-canvas-no-pan を持たない（掴むと盤面が動く）';
          }
        }
        return true;
      },
    },
    {
      id: 'board-owns-the-pinch',
      description: '盤面が touch-action: none を持つ（ピンチをブラウザに奪われない）',
      check: ({ root }) => {
        const frame = root.querySelector('[role="application"]');
        if (!(frame instanceof HTMLElement)) return '盤面（role=application）が無い';
        return (
          frame.style.touchAction === 'none' ||
          `盤面の touch-action が ${frame.style.touchAction || '未設定'}`
        );
      },
    },
    {
      id: 'empty-board-has-message',
      description: 'カードが 0 枚なら文言を出す',
      check: ({ root, contract }) => {
        if (contract.cardCount !== '0') return true;
        return Boolean(root.querySelector('p')) || '空のボードに文言が出ていない';
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
