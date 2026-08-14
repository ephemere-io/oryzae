/**
 * JarViewSkeleton の検証スペック。
 * 「/jar は一覧ではなく全面キャンバス」であることを DOM で固定する
 * （一覧枠を出していたのが今回の作り直しの発端）。
 */

import { registerUnit } from '@oryzae/verify';
import { JAR_PATH } from '@/features/pc/fermentation/utils/jar-shape';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { JarViewSkeleton } from './jar-view-skeleton';

interface Props {
  circles?: number;
}

registerUnit<Props>({
  id: 'JarViewSkeleton',
  title: 'JarViewSkeleton',
  description: 'PC 瓶（/jar）のロード枠: 全面キャンバス ＋ 中央の瓶 ＋ 問いの円',
  kind: 'component',
  render: (props) => <JarViewSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（問いの円3件ぶん）', props: {} },
    {
      id: 'no-circles',
      probe: true,
      description: 'Probe: 問いが0件でも瓶とキャンバスは残る（画面の主役は瓶）',
      props: { circles: 0 },
    },
    {
      id: 'over-cap',
      probe: true,
      description: 'Probe: 既定配置は3件までなので、それ以上を要求しても3件で頭打ち',
      props: { circles: 9 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'jar-silhouette-matches-real',
      description: '瓶の輪郭が本物と同じ path（読み込み完了時に主役が動かない）',
      check: ({ root }) => {
        const path = root.querySelector('[data-skeleton-slot="jar"] path');
        return path?.getAttribute('d') === JAR_PATH || '瓶の輪郭が JarView 本体と一致しない';
      },
    },
    {
      id: 'circles-capped-at-fallback-positions',
      description: '問いの円は既定配置（最大3）を超えない',
      check: ({ root, props }) => {
        const drawn = root.querySelectorAll('[data-skeleton-slot="circle"]').length;
        const expected = Math.min(3, Math.max(0, props.circles ?? 3));
        return drawn === expected || `円の数が不一致: ${drawn} (期待: ${expected})`;
      },
    },
    {
      id: 'no-list-rows',
      description: '一覧の行枠を持たない（/jar は一覧画面ではない）',
      check: ({ root }) =>
        root.querySelector('[data-skeleton-slot="rows"]') === null ||
        '瓶のスケルトンに一覧の行枠が混ざっている',
    },
  ],
});
