/**
 * QuestionSelectModal の検証スペック（A 移植）。
 * 問い紐付けモーダル。open=true で描画されるダイアログを孤立検証する。
 * - 既存の問いがあれば pick モード（select 表示）、無ければ create モード（input 表示）。
 * - 内部 state（mode / canConfirm）を DOM 契約として公表し、
 *   「select 表示が mode×availableCount と一致」「submit の disabled が契約と一致」を検証する。
 * - act fixture で pick→create 切替＋入力まで再生し、canConfirm が立つことを確認する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionSelectModal } from './question-select-modal';

interface QuestionOption {
  id: string;
  currentText: string | null;
}

interface QuestionSelectModalProps {
  open: boolean;
  saving: boolean;
  activeQuestions: QuestionOption[];
  linkedQuestionIds: Set<string>;
  onConfirm: (args: { existingId: string | null; newQuestionText: string | null }) => void;
  onClose: () => void;
}

const noop = () => {};

const SAMPLE_QUESTIONS: QuestionOption[] = [
  { id: 'q1', currentText: '今日の小さな発見は？' },
  { id: 'q2', currentText: '今いちばん気になっていることは？' },
];

registerUnit<QuestionSelectModalProps>({
  id: 'QuestionSelectModal',
  title: 'QuestionSelectModal',
  description: 'エントリに問いを紐付けるモーダル（既存から選ぶ / 新規で書く）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<QuestionSelectModal {...props} />),
  fixtures: [
    {
      id: 'pick',
      description: '既存の問いから選ぶ（pick モード・select 表示）',
      props: {
        open: true,
        saving: false,
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(),
        onConfirm: noop,
        onClose: noop,
      },
    },
    {
      id: 'create-empty',
      description: '選べる問いが無く新規作成へフォールバック（create モード・input 表示）',
      props: {
        open: true,
        saving: false,
        activeQuestions: [],
        linkedQuestionIds: new Set<string>(),
        onConfirm: noop,
        onClose: noop,
      },
    },
    {
      id: 'saving',
      description: '漬け込み中（saving=true で submit が無効）',
      props: {
        open: true,
        saving: true,
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(),
        onConfirm: noop,
        onClose: noop,
      },
    },
    {
      id: 'switch-and-type',
      description: 'pick から create へ切替えて入力 → canConfirm が立つ',
      props: {
        open: true,
        saving: false,
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(),
        onConfirm: noop,
        onClose: noop,
      },
      act: async (ctx) => {
        await ctx.click('input[value="create"]');
        await ctx.wait(16);
        await ctx.type('input[type="text"]', '今日の小さな発見');
        await ctx.wait(16);
      },
    },
    {
      id: 'null-and-long-text',
      probe: true,
      description:
        'Probe: currentText=null の問いと約2000字の問いが混在しても option 描画が崩れない',
      props: {
        open: true,
        saving: false,
        activeQuestions: [
          { id: 'q-null', currentText: null },
          { id: 'q-long', currentText: 'あ'.repeat(2000) },
        ],
        linkedQuestionIds: new Set<string>(),
        onConfirm: noop,
        onClose: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'select-shown-matches-mode',
      description: 'select の表示が「pick モード かつ availableCount>0」と一致する',
      check: ({ root, contract }) => {
        const hasSelect = Boolean(root.querySelector('select'));
        const shouldShowSelect = contract.mode === 'pick' && Number(contract.availableCount) > 0;
        return (
          hasSelect === shouldShowSelect ||
          `select 表示=${hasSelect} だが mode=${contract.mode} availableCount=${contract.availableCount} → 期待=${shouldShowSelect}`
        );
      },
    },
    {
      id: 'submit-disabled-matches-contract',
      description: 'submit ボタンの disabled が (saving || !canConfirm) と一致する',
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (!btn) return 'submit ボタンが見つからない';
        const expectedDisabled = contract.saving === 'true' || contract.canConfirm === 'false';
        return (
          btn.disabled === expectedDisabled ||
          `submit.disabled=${btn.disabled} だが契約上の期待=${expectedDisabled} (saving=${contract.saving}, canConfirm=${contract.canConfirm})`
        );
      },
    },
    {
      id: 'pick-cannot-confirm-without-selection',
      description: 'pick モード初期は未選択なので canConfirm=false',
      onlyFixtures: ['pick'],
      check: ({ contract }) =>
        contract.canConfirm === 'false' ||
        `pick 初期で canConfirm=${contract.canConfirm}（false を期待）`,
    },
    {
      id: 'type-enables-confirm-in-create-mode',
      description: 'create へ切替えて入力後は mode=create かつ canConfirm=true',
      onlyFixtures: ['switch-and-type'],
      check: ({ contract }) => {
        if (contract.mode !== 'create') return `切替後 mode=${contract.mode}（create を期待）`;
        return (
          contract.canConfirm === 'true' ||
          `入力後 canConfirm=${contract.canConfirm}（true を期待）`
        );
      },
    },
  ],
});
