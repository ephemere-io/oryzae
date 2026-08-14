/**
 * EntryListSkeleton の検証スペック。
 * 「実 EntryList と同じ縦順（フィルタ→検索→行）を先に置けているか」を DOM で確認する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { EntryListSkeleton } from './entry-list-skeleton';

interface Props {
  rows?: number;
  withFilter?: boolean;
}

registerUnit<Props>({
  id: 'EntryListSkeleton',
  title: 'EntryListSkeleton',
  description: 'PC 一覧（EntryList）のロード枠: 問いフィルタ → 検索 → 月/週見出し → カード行',
  kind: 'component',
  render: (props) => <EntryListSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（フィルタあり・4行）', props: {} },
    {
      id: 'no-filter',
      description: '問いが1件も無い場合（EntryList はフィルタ行を出さない）',
      props: { withFilter: false },
    },
    {
      id: 'zero-rows',
      probe: true,
      description: 'Probe: 行0でも chrome（検索バー）は残り、枠が消えない',
      props: { rows: 0 },
    },
    {
      id: 'many-rows',
      probe: true,
      description: 'Probe: 行が多くても構造は同じ（行数だけが増える）',
      props: { rows: 12 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'filter-slot-follows-props',
      description: 'withFilter=false のときだけフィルタ行を描かない（実 EntryList と同じ条件）',
      check: ({ root, props }) => {
        const has = Boolean(root.querySelector('[data-skeleton-slot="filter"]'));
        const expected = props.withFilter !== false;
        return has === expected || `filter 行の有無が props と不一致: has=${has}`;
      },
    },
    {
      id: 'search-precedes-rows',
      description: '検索バーが行より前にある（実 EntryList の縦順と一致）',
      check: ({ root }) => {
        const search = root.querySelector('[data-skeleton-slot="search"]');
        const rows = root.querySelector('[data-skeleton-slot="rows"]');
        if (!search || !rows) return 'search / rows の slot が見つからない';
        return (
          Boolean(search.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING) ||
          '検索バーより前に行が描かれている（実画面と縦順が違う）'
        );
      },
    },
  ],
});
