/**
 * WritingStatsSkeleton の検証スペック。
 *
 * この枠の存在意義は「実物と同じ数だけ場所を取ること」なので、**件数が固定であること**を
 * 直接固定する。サマリーカード6枚と月次推移12行は実装side（StatCard の並びと
 * user-me.ts の12ヶ月ループ）で決まっており、ここがズレると読み込み完了時に
 * 画面が伸び縮みする＝この枠を入れた意味が無くなる。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { WritingStatsSkeleton } from './writing-stats-skeleton';

/** サマリーカードの枚数（実 WritingStats の StatCard と同数）。 */
const CARD_COUNT = 6;
/** 月次推移の行数（サーバーが必ず12ヶ月分返す）。 */
const MONTH_ROWS = 12;

registerUnit<Record<string, never>>({
  id: 'WritingStatsSkeleton',
  title: 'WritingStatsSkeleton',
  description: 'アカウント画面の統計セクションのロード枠: サマリーカード6枚 ＋ 月次推移12行',
  kind: 'component',
  render: () => <WritingStatsSkeleton />,
  fixtures: [
    {
      id: 'loading',
      probe: true,
      description:
        'Probe: 統計取得中（このユニットが取りうる唯一の状態）。高さゼロを返さないことがこの枠の目的',
      props: {},
    },
  ],
  invariants: [
    ...skeletonInvariants<Record<string, never>>(),
    {
      id: 'card-count-matches-real',
      description: `サマリーカードが実物と同数（${CARD_COUNT}枚）`,
      check: ({ root }) => {
        const cards = root.querySelector('[data-skeleton-slot="cards"]');
        const actual = cards?.childElementCount ?? -1;
        return actual === CARD_COUNT || `カード枚数が不一致: ${actual} (期待: ${CARD_COUNT})`;
      },
    },
    {
      id: 'month-rows-match-server',
      description: `月次推移がサーバーの返す月数と同数（${MONTH_ROWS}行）`,
      check: ({ root }) => {
        const rows = root.querySelector('[data-skeleton-slot="monthly-trend"] > div:last-child');
        const actual = rows?.childElementCount ?? -1;
        return actual === MONTH_ROWS || `行数が不一致: ${actual} (期待: ${MONTH_ROWS})`;
      },
    },
    {
      id: 'not-empty',
      description: '高さゼロを返さない（この枠を入れた目的そのもの）',
      check: ({ root }) => {
        const el = root.querySelector('[data-verify-unit="WritingStatsSkeleton"]');
        return (el?.childElementCount ?? 0) > 0 || '枠が空（場所取りになっていない）';
      },
    },
  ],
});
