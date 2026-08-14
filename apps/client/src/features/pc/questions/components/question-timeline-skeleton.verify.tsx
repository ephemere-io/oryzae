/**
 * QuestionTimelineSkeleton の検証スペック。
 * 一覧の行枠ではなく「見出し ＋ 左罫のあるタイムライン」であることを固定する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { QuestionTimelineSkeleton } from './question-timeline-skeleton';

interface Props {
  groups?: number;
  eventsPerGroup?: number;
}

registerUnit<Props>({
  id: 'QuestionTimelineSkeleton',
  title: 'QuestionTimelineSkeleton',
  description: 'PC 問い（/questions）のロード枠: 中央見出し ＋ 日付ノード付きタイムライン',
  kind: 'component',
  render: (props) => <QuestionTimelineSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（2ノード × 2カード）', props: {} },
    {
      id: 'single-event',
      probe: true,
      description: 'Probe: 1ノード1カードでも縦罫と見出しは残る',
      props: { groups: 1, eventsPerGroup: 1 },
    },
    {
      id: 'no-groups',
      probe: true,
      description: 'Probe: ノード0でも見出しとタイムライン枠は消えない',
      props: { groups: 0 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'timeline-has-left-rail',
      description: 'タイムラインの左に縦罫がある（実 QuestionTimeline と同じ左インデント）',
      check: ({ root }) => {
        const timeline = root.querySelector('[data-skeleton-slot="timeline"]');
        if (!timeline) return 'timeline slot が無い';
        const rail = timeline.querySelector('.absolute.left-\\[7px\\]');
        return Boolean(rail) || '左の縦罫が描かれていない';
      },
    },
    {
      id: 'group-count-matches',
      description: '日付ノードの数が指定どおり（縦罫を除いた子の数）',
      check: ({ root, props }) => {
        const timeline = root.querySelector('[data-skeleton-slot="timeline"]');
        const expected = props.groups ?? 2;
        const actual = (timeline?.childElementCount ?? 0) - 1; // 先頭は縦罫
        return actual === expected || `ノード数が不一致: ${actual} (期待: ${expected})`;
      },
    },
  ],
});
