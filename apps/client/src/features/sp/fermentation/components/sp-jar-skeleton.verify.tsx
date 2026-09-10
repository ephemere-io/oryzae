/**
 * SpJarSkeleton の検証スペック。
 *
 * SP の /jar は一覧ではなく「中央の壜と、そのまわりを回る問いの円」。行の枠を置くと
 * 到着時に画面が丸ごと入れ替わって見えるので、壜と円の位置を先に置く形であることを固定する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { SpJarSkeleton } from './sp-jar-skeleton';

interface Props {
  circles?: number;
}

registerUnit<Props>({
  id: 'SpJarSkeleton',
  title: 'SpJarSkeleton',
  description: 'SP 瓶（/jar）のロード枠: ヘッダ ＋ 中央の壜 ＋ 軌道上の円 ＋ 問いを整えるボタン',
  kind: 'component',
  render: (props) => (
    <div style={{ position: 'relative', width: '390px', height: '640px' }}>
      <SpJarSkeleton {...props} />
    </div>
  ),
  fixtures: [
    { id: 'default', description: '既定（円3つ）', props: {} },
    {
      id: 'no-circles',
      probe: true,
      description: 'Probe: 問い0件でも壜とボタンの枠は残る（実画面と同じ）',
      props: { circles: 0 },
    },
    {
      id: 'one-circle',
      probe: true,
      description: 'Probe: 円が1つでも形は同じ',
      props: { circles: 1 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'circle-count-matches',
      description: '円の数が指定どおり（壜の枠は数に入れない）',
      check: ({ root, props }) => {
        const orbit = root.querySelector('[data-skeleton-slot="orbit"]');
        const expected = props.circles ?? 3;
        // 直下の子は「壜」＋「円」なので、壜のぶんを差し引く。
        const actual = (orbit?.childElementCount ?? 0) - 1;
        return actual === expected || `円の数が不一致: ${actual} (期待: ${expected})`;
      },
    },
    {
      id: 'jar-stays-centered',
      description: '壜の枠は中央にある（実画面と同じ位置に来ないと到着時に飛ぶ）',
      check: ({ root }) => {
        const jar = root.querySelector('[data-skeleton-slot="jar"]');
        if (!(jar instanceof HTMLElement)) return '壜の枠が無い';
        return (
          (jar.style.left === '50%' && jar.style.top === '47%') ||
          `壜の枠が中央でない: left=${jar.style.left}, top=${jar.style.top}`
        );
      },
    },
    {
      id: 'circles-are-round',
      description: '円の枠は丸い（一覧の行と見間違えない）',
      check: ({ root }) => {
        const circles = Array.from(root.querySelectorAll('[data-skeleton-slot="orbit"] > *')).slice(
          1,
        );
        if (circles.length === 0) return true;
        const bad = circles.filter(
          (c) => !c.firstElementChild?.classList.contains('rounded-full'),
        ).length;
        return bad === 0 || `${bad} 個の枠が丸くない`;
      },
    },
  ],
});
