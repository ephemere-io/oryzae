/**
 * BoardViewSkeleton の検証スペック。
 * 「四隅の chrome は必ず出る／カードは無くても盤面は成立する」ことを固定する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { BoardViewSkeleton } from './board-view-skeleton';

interface Props {
  cards?: number;
}

registerUnit<Props>({
  id: 'BoardViewSkeleton',
  title: 'BoardViewSkeleton',
  description: 'PC ボード（/board）のロード枠: 方眼 ＋ 四隅の chrome ＋ 散らばる紙片',
  kind: 'component',
  render: (props) => <BoardViewSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（カード5枚）', props: {} },
    {
      id: 'empty-board',
      probe: true,
      description: 'Probe: カード0枚でも方眼と四隅の chrome は残る',
      props: { cards: 0 },
    },
    {
      id: 'over-cap',
      probe: true,
      description: 'Probe: 代表配置は5枚までなので、それ以上を要求しても増えない',
      props: { cards: 20 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'corner-chrome-always-present',
      description: 'カード数によらず四隅の chrome（日付ナビ / 表示切替 / カード数）が出る',
      check: ({ root }) => {
        const missing = ['date-nav', 'controls', 'card-count'].filter(
          (slot) => !root.querySelector(`[data-skeleton-slot="${slot}"]`),
        );
        return missing.length === 0 || `四隅の chrome が欠けている: ${missing.join(', ')}`;
      },
    },
    {
      id: 'cards-capped',
      description: 'カードの枠は代表配置の数を超えない',
      check: ({ root, props }) => {
        const drawn = root.querySelectorAll('[data-skeleton-slot="card"]').length;
        const expected = Math.min(5, Math.max(0, props.cards ?? 5));
        return drawn === expected || `カード枠の数が不一致: ${drawn} (期待: ${expected})`;
      },
    },
  ],
});
