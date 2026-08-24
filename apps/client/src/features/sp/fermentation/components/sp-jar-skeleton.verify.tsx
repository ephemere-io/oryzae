/**
 * SpJarSkeleton の検証スペック。
 * エントリ一覧の行と混同されない形（先頭に未読ドットがある受信箱の行）であることを固定する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { SpJarSkeleton } from './sp-jar-skeleton';

interface Props {
  rows?: number;
}

registerUnit<Props>({
  id: 'SpJarSkeleton',
  title: 'SpJarSkeleton',
  description: 'SP 瓶（/jar）のロード枠: ヘッダ ＋ 手紙の行（未読ドット＋問い文＋メタ）',
  kind: 'component',
  render: (props) => <SpJarSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（6行）', props: {} },
    {
      id: 'zero-rows',
      probe: true,
      description: 'Probe: 手紙0件でもヘッダは残る（空表示に置き換わるだけ）',
      props: { rows: 0 },
    },
    {
      id: 'many-rows',
      probe: true,
      description: 'Probe: 行が多くても形は同じ',
      props: { rows: 20 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'rows-count-matches',
      description: '行数が指定どおり',
      check: ({ root, props }) => {
        const rows = root.querySelector('[data-skeleton-slot="rows"]');
        const expected = props.rows ?? 6;
        const actual = rows?.childElementCount ?? -1;
        return actual === expected || `行数が不一致: ${actual} (期待: ${expected})`;
      },
    },
    {
      id: 'each-row-leads-with-dot',
      description: '各行の先頭に未読ドットの枠がある（エントリ一覧の行とは別の形）',
      check: ({ root }) => {
        const rows = Array.from(root.querySelectorAll('[data-skeleton-slot="rows"] > *'));
        if (rows.length === 0) return true;
        const bad = rows.filter(
          (r) => !r.firstElementChild?.classList.contains('rounded-full'),
        ).length;
        return bad === 0 || `${bad} 行の先頭にドットの枠が無い`;
      },
    },
  ],
});
