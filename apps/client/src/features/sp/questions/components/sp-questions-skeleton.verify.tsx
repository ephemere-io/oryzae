/**
 * SpQuestionsSkeleton の検証スペック。
 * カードが0でも「追加ボタン」の枠が残る（実 SpQuestions は問い0件でも追加ボタンを出す）。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { SpQuestionsSkeleton } from './sp-questions-skeleton';

interface Props {
  cards?: number;
}

registerUnit<Props>({
  id: 'SpQuestionsSkeleton',
  title: 'SpQuestionsSkeleton',
  description: 'SP 問い（/questions）のロード枠: ヘッダ / 説明文 / 角丸カード / 破線の追加ボタン',
  kind: 'component',
  render: (props) => <SpQuestionsSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（カード4枚）', props: {} },
    {
      id: 'no-cards',
      probe: true,
      description: 'Probe: 問い0件でも追加ボタンの枠は残る（実画面と同じ）',
      props: { cards: 0 },
    },
    {
      id: 'many-cards',
      probe: true,
      description: 'Probe: カードが多くても形は同じ',
      props: { cards: 15 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'add-button-always-present',
      description: 'カード数によらず追加ボタンの枠がある',
      check: ({ root }) =>
        Boolean(root.querySelector('[data-skeleton-slot="add"]')) || '追加ボタンの枠が無い',
    },
    {
      id: 'card-count-matches',
      description: 'カード数が指定どおり（追加ボタンは数に含めない）',
      check: ({ root, props }) => {
        const cards = root.querySelector('[data-skeleton-slot="cards"]');
        const expected = props.cards ?? 4;
        const actual = (cards?.childElementCount ?? 0) - 1; // 末尾は追加ボタン
        return actual === expected || `カード数が不一致: ${actual} (期待: ${expected})`;
      },
    },
  ],
});
