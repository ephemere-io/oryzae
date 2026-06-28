/**
 * QuestionLinker の検証スペック（A 移植）。
 * activeQuestions を linkedQuestionIds で「未紐付け（select の option）」と
 * 「紐付け済み（チップ）」に分割する純表示部品。i18n（useTranslations）は
 * withVerifyProviders（NextIntlClientProvider）が供給する。状態（select の selected）は
 * 孤立検証では駆動できない（act.type は input イベントで select の change を発火しない）ため、
 * props による状態分割と「契約↔DOM/props の一致」を invariant で検証する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionLinker } from './question-linker';

interface QuestionOption {
  id: string;
  currentText: string | null;
}

interface QuestionLinkerProps {
  activeQuestions: QuestionOption[];
  linkedQuestionIds: Set<string>;
  onLink: (questionId: string) => void;
  onUnlink: (questionId: string) => void;
}

const noop = () => {};

const SAMPLE_QUESTIONS: QuestionOption[] = [
  { id: 'q1', currentText: '今日いちばん心が動いた瞬間は？' },
  { id: 'q2', currentText: '明日の自分に伝えたいことは？' },
  { id: 'q3', currentText: '最近うれしかった小さなことは？' },
];

registerUnit<QuestionLinkerProps>({
  id: 'QuestionLinker',
  title: 'QuestionLinker',
  description: 'エントリに問いを紐づける UI（未紐付けの select ＋ 紐付け済みチップ）',
  kind: 'component',
  render: (props) => withVerifyProviders(<QuestionLinker {...props} />),
  fixtures: [
    {
      id: 'none-linked',
      description: '全て未紐付け（チップなし・select に3件）',
      props: {
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(),
        onLink: noop,
        onUnlink: noop,
      },
    },
    {
      id: 'partially-linked',
      description: '一部紐付け済み（select 2件・チップ1件）',
      props: {
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(['q1']),
        onLink: noop,
        onUnlink: noop,
      },
    },
    {
      id: 'all-linked',
      description: '全て紐付け済み（select はプレースホルダのみ・チップ3件）',
      props: {
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(['q1', 'q2', 'q3']),
        onLink: noop,
        onUnlink: noop,
      },
    },
    {
      id: 'null-text',
      probe: true,
      description: 'Probe: currentText=null（型上許容）でも option/チップが崩れず描画される',
      props: {
        activeQuestions: [
          { id: 'q1', currentText: null },
          { id: 'q2', currentText: '通常の問い' },
        ],
        linkedQuestionIds: new Set<string>(['q2']),
        onLink: noop,
        onUnlink: noop,
      },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: activeQuestions が空でも崩れない（チップ群は非表示分岐）',
      props: {
        activeQuestions: [],
        linkedQuestionIds: new Set<string>(),
        onLink: noop,
        onUnlink: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'partition-covers-all-questions',
      description: 'availableCount + linkedCount が activeQuestions 総数に一致する（分割の完全性）',
      check: ({ contract, props }) => {
        const total = Number(contract.availableCount) + Number(contract.linkedCount);
        return (
          total === props.activeQuestions.length ||
          `partition 不一致: available=${contract.availableCount} + linked=${contract.linkedCount} ≠ ${props.activeQuestions.length}`
        );
      },
    },
    {
      id: 'linked-count-matches-chips',
      description: 'linkedCount 契約が描画された紐付けチップ（×ボタン）の数と一致する',
      check: ({ root, contract }) => {
        const chips = root.querySelectorAll('span.inline-flex').length;
        return (
          chips === Number(contract.linkedCount) ||
          `linkedCount=${contract.linkedCount} だが DOM 上のチップは ${chips} 個`
        );
      },
    },
    {
      id: 'available-options-match-contract',
      description: 'select の option 数 = availableCount + 1（先頭プレースホルダ option の分）',
      check: ({ root, contract }) => {
        const options = root.querySelectorAll('select option').length;
        const expected = Number(contract.availableCount) + 1;
        return (
          options === expected ||
          `option 数=${options}, 期待=${expected}（availableCount=${contract.availableCount} + placeholder 1）`
        );
      },
    },
  ],
});
