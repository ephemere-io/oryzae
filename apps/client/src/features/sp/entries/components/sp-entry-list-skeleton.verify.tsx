/**
 * SpEntryListSkeleton の検証スペック。
 * PC 一覧と縦順が違う（ヘッダ→検索→問いチップ→行）ことを DOM で固定する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { SpEntryListSkeleton } from './sp-entry-list-skeleton';

interface Props {
  rows?: number;
  chips?: number;
}

registerUnit<Props>({
  id: 'SpEntryListSkeleton',
  title: 'SpEntryListSkeleton',
  description: 'SP 一覧のロード枠: ヘッダ（タイトル＋並び替え）→ 検索 → 問いチップ → 行',
  kind: 'component',
  render: (props) => <SpEntryListSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（チップ3・行7）', props: {} },
    {
      id: 'no-chips',
      probe: true,
      description: 'Probe: 問いが0件ならチップ行を出さない（実 SpEntryList と同じ条件）',
      props: { chips: 0 },
    },
    {
      id: 'zero-rows',
      probe: true,
      description: 'Probe: 行0でもヘッダ・検索は残る',
      props: { rows: 0 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'chips-slot-follows-props',
      description: 'chips=0 のときだけチップ行を描かない',
      check: ({ root, props }) => {
        const has = Boolean(root.querySelector('[data-skeleton-slot="chips"]'));
        const expected = (props.chips ?? 3) > 0;
        return has === expected || `チップ行の有無が props と不一致: has=${has}`;
      },
    },
    {
      id: 'header-is-first',
      description: 'ヘッダが最上段（SP はページ chrome を画面自身が持つ）',
      check: ({ root }) => {
        const first = root.querySelector('[data-skeleton-slot]');
        return (
          first?.getAttribute('data-skeleton-slot') === 'header' ||
          `最初の slot が header ではない: ${first?.getAttribute('data-skeleton-slot')}`
        );
      },
    },
  ],
});
