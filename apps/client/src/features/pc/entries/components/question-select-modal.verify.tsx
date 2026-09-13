/**
 * QuestionSelectModal の検証スペック。
 *
 * 中身は SP と同じ選び手（QuestionPicker）。見るのは: 行の数が問いの数、結んでいる行に印、
 * 結んだ問いが無ければ「紐付けて漬け込む」は押せない、問いが無ければ書く欄で始まる。
 */

import { registerUnit } from '@oryzae/verify';
import type { LinkedQuestion } from '@/features/shared/entry-questions/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionSelectModal } from './question-select-modal';

interface Props {
  saving: boolean;
  activeQuestions: LinkedQuestion[];
  linkedQuestionIds: string[];
}

const noop = () => {};

const SAMPLE_QUESTIONS: LinkedQuestion[] = [
  { id: 'q1', currentText: '今日の小さな発見は？' },
  { id: 'q2', currentText: '今いちばん気になっていることは？' },
];

registerUnit<Props>({
  id: 'QuestionSelectModal',
  title: 'QuestionSelectModal',
  description: '問いを結んで漬け込むモーダル（SP と同じ選び手。複数結べる・その場で書ける）。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <QuestionSelectModal
        open
        saving={props.saving}
        activeQuestions={props.activeQuestions}
        linkedQuestionIds={new Set(props.linkedQuestionIds)}
        onToggle={noop}
        onCreate={() => Promise.resolve('q-new')}
        onProceed={noop}
        onClose={noop}
      />,
    ),
  fixtures: [
    {
      id: 'none-linked',
      description: '問いはあるがどれも結んでいない（漬け込むは押せない）',
      props: { saving: false, activeQuestions: SAMPLE_QUESTIONS, linkedQuestionIds: [] },
    },
    {
      id: 'one-linked',
      description: '1 つ結んでいる（漬け込める）',
      props: { saving: false, activeQuestions: SAMPLE_QUESTIONS, linkedQuestionIds: ['q1'] },
    },
    {
      id: 'create-empty',
      description: '選べる問いが無く、書く欄で始まる',
      props: { saving: false, activeQuestions: [], linkedQuestionIds: [] },
    },
    {
      id: 'saving',
      description: '漬け込み中（結んでいても submit は無効）',
      props: { saving: true, activeQuestions: SAMPLE_QUESTIONS, linkedQuestionIds: ['q1'] },
    },
    {
      id: 'null-and-long-text',
      probe: true,
      description: 'Probe: currentText=null の問いと約2000字の問いが混在しても行が崩れない',
      props: {
        saving: false,
        activeQuestions: [
          { id: 'q-null', currentText: null },
          { id: 'q-long', currentText: 'あ'.repeat(2000) },
        ],
        linkedQuestionIds: [],
      },
    },
  ],
  invariants: [
    {
      id: 'picker-inside',
      description: '中身は共有の選び手（QuestionPicker）',
      check: ({ root }) =>
        Boolean(root.querySelector('[data-verify-unit="QuestionPicker"]')) ||
        'QuestionPicker が見つからない',
    },
    {
      id: 'rows-match-questions',
      description: '書く欄でなければ、行の数が問いの数と一致する',
      check: ({ root, contract }) => {
        if (contract.composing === 'true') return true;
        const rows = root.querySelectorAll('li button[aria-pressed]').length;
        return (
          rows === Number(contract.questionCount) ||
          `行 ${rows} 件だが問いは ${contract.questionCount} 件`
        );
      },
    },
    {
      id: 'pressed-matches-linked',
      description: '印の付いた行の数が結んでいる数と一致する',
      check: ({ root, contract }) => {
        if (contract.composing === 'true') return true;
        const pressed = root.querySelectorAll('li button[aria-pressed="true"]').length;
        return (
          pressed === Number(contract.linkedCount) ||
          `印 ${pressed} 件だが結んでいるのは ${contract.linkedCount} 件`
        );
      },
    },
    {
      id: 'submit-disabled-matches-contract',
      description: 'submit ボタンの disabled が (saving || !canProceed) と一致する',
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (!btn) return 'submit ボタンが見つからない';
        const expectedDisabled = contract.saving === 'true' || contract.canProceed === 'false';
        return (
          btn.disabled === expectedDisabled ||
          `submit.disabled=${btn.disabled} だが契約上の期待=${expectedDisabled} (saving=${contract.saving}, canProceed=${contract.canProceed})`
        );
      },
    },
    {
      id: 'compose-when-no-questions',
      description: '問いが無ければ書く欄で始まる',
      onlyFixtures: ['create-empty'],
      check: ({ root, contract }) =>
        (contract.composing === 'true' && Boolean(root.querySelector('input[type="text"]'))) ||
        `composing=${contract.composing} で書く欄が無い`,
    },
  ],
});
