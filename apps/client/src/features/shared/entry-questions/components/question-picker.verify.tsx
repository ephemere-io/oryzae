/**
 * QuestionPicker の検証スペック。
 *
 * その場で開く選び手。見るのは: 行の数が問いの数、選んでいる行に pressed が付く、
 * 押しても閉じない（複数選べる）、問いが無ければ書く欄、書く欄は行き止まりにしない。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import type { LinkedQuestion } from '../types';
import { QuestionPicker } from './question-picker';

interface Props {
  questions: LinkedQuestion[];
  selectedIds: string[];
  composing: boolean;
}

const QUESTIONS: LinkedQuestion[] = [
  { id: 'q-1', currentText: 'なぜ書くのか' },
  { id: 'q-2', currentText: '何を恐れているのか' },
  { id: 'q-3', currentText: null },
];

const noop = () => {};

registerUnit<Props>({
  id: 'QuestionPicker',
  title: 'QuestionPicker',
  description: '問いを結ぶ選び手（その場で開く・複数選べる）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ width: '390px', padding: '16px' }}>
        <QuestionPicker
          questions={props.questions}
          selectedIds={props.selectedIds}
          onToggle={noop}
          onCreate={() => Promise.resolve('q-new')}
          composing={props.composing}
          onComposingChange={noop}
          onClose={noop}
        />
      </div>,
    ),
  fixtures: [
    {
      id: 'list',
      description: '3 つの問い、1 つ結んでいる',
      props: { questions: QUESTIONS, selectedIds: ['q-1'], composing: false },
    },
    {
      id: 'two-selected',
      description: '2 つ結んでいる（複数）',
      props: { questions: QUESTIONS, selectedIds: ['q-1', 'q-2'], composing: false },
    },
    {
      id: 'compose',
      description: '問いが無い（書く欄）',
      props: { questions: [], selectedIds: [], composing: true },
    },
    {
      id: 'toggle',
      probe: true,
      description: 'Probe: 行を押しても選び手は閉じない（複数選べる）',
      props: { questions: QUESTIONS, selectedIds: ['q-1'], composing: false },
      act: async (ctx) => {
        await ctx.click('li:first-child button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'rows-match-questions',
      description: '行の数が問いの数と一致する（探していないとき）',
      check: ({ root, contract }) => {
        if (contract.composing === 'true') return true;
        const rows = root.querySelectorAll('li button[aria-pressed]').length;
        return (
          String(rows) === contract.questionCount || `行=${rows}, 問い=${contract.questionCount}`
        );
      },
    },
    {
      id: 'pressed-matches-selection',
      description: '選んでいる行の数が selectedCount と一致する',
      check: ({ root, contract }) => {
        if (contract.composing === 'true') return true;
        const pressed = root.querySelectorAll('li button[aria-pressed="true"]').length;
        return (
          String(pressed) === contract.selectedCount ||
          `pressed=${pressed}, selectedCount=${contract.selectedCount}`
        );
      },
    },
    {
      id: 'stays-open-after-toggle',
      description: '行を押した後も選び手が残る（閉じない）',
      onlyFixtures: ['toggle'],
      check: ({ root }) =>
        root.querySelector('[data-verify-unit="QuestionPicker"]') !== null || '押したら閉じた',
    },
    {
      id: 'compose-has-input',
      description: '書く欄のモードには必ず入力欄がある（行き止まりにしない）',
      onlyFixtures: ['compose'],
      check: ({ root }) =>
        root.querySelector('input[aria-label^="問いを書く"]') !== null || '入力欄が無い',
    },
  ],
});
