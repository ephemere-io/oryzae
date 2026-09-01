/**
 * QuestionChip の検証スペック。
 *
 * QuestionLinker（select ＋ ＋ボタン ＋ チップ列）の置き換え。閉じている状態では
 * 「いま結ばれている問い」1件ぶんのチップだけを描き、ドロップダウンは act.click で開く。
 * i18n は withVerifyProviders（NextIntlClientProvider）が供給する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionChip } from './question-chip';

interface QuestionOption {
  id: string;
  currentText: string | null;
}

interface QuestionChipProps {
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

/** 面を開くチップ（「+」）。結ばれた問いのチップが前に並ぶので、最後の1つを指す。 */
const ADD_CHIP_SELECTOR = '[data-verify-unit="QuestionChip"] button[aria-haspopup="menu"]';

registerUnit<QuestionChipProps>({
  id: 'QuestionChip',
  title: 'QuestionChip',
  description: 'トップバー中央の問いチップ（結ばれている問いの表示 ＋ 付け外しドロップダウン）',
  kind: 'component',
  render: (props) => withVerifyProviders(<QuestionChip {...props} />),
  fixtures: [
    {
      id: 'unlinked',
      description: '未紐付け（破線チップ「問いを結ぶ」）',
      props: {
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(),
        onLink: noop,
        onUnlink: noop,
      },
    },
    {
      id: 'linked',
      description: '1件紐付け済み（問い文がチップに出る）',
      props: {
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(['q2']),
        onLink: noop,
        onUnlink: noop,
      },
    },
    {
      id: 'open',
      description: 'チップをクリックしてドロップダウンを開いた状態',
      props: {
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(['q1']),
        onLink: noop,
        onUnlink: noop,
      },
      act: async ({ click, wait }) => {
        await click(ADD_CHIP_SELECTOR);
        await wait(0);
      },
    },
    {
      id: 'multi-linked',
      probe: true,
      description: 'Probe: 複数紐付け（先頭のみ表示し残りは +n に畳む）',
      props: {
        activeQuestions: SAMPLE_QUESTIONS,
        linkedQuestionIds: new Set<string>(['q1', 'q2', 'q3']),
        onLink: noop,
        onUnlink: noop,
      },
    },
    {
      id: 'null-text-and-empty',
      probe: true,
      description: 'Probe: currentText=null / 問いが0件でもチップが崩れない',
      props: {
        activeQuestions: [{ id: 'q1', currentText: null }],
        linkedQuestionIds: new Set<string>(['q1']),
        onLink: noop,
        onUnlink: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'linked-contract-matches-props',
      description: 'linkedCount 契約が props の紐付け件数と一致する',
      check: ({ contract, props }) => {
        const expected = props.activeQuestions.filter((q) =>
          props.linkedQuestionIds.has(q.id),
        ).length;
        return (
          Number(contract.linkedCount) === expected ||
          `linkedCount=${contract.linkedCount} だが props 上は ${expected} 件`
        );
      },
    },
    {
      id: 'closed-renders-single-trigger',
      description: '閉じているときは面を描かない（本文の邪魔をしない）',
      check: ({ root, contract }) => {
        const panel = root.querySelector('[role="menu"]');
        if (contract.open === 'true') return true;
        return panel === null || '閉じているのに面が描画されている';
      },
    },
    {
      id: 'open-lists-every-active-question',
      // 問いは**付け外し**（menu / menuitemcheckbox）。面と行は設定パネルの Select と同じ部品。
      description: '開いているときは行が activeQuestions と同数（過不足なく選べる）',
      onlyFixtures: ['open'],
      check: ({ root, props }) => {
        const options = root.querySelectorAll('[role="menuitemcheckbox"]').length;
        return (
          options === props.activeQuestions.length ||
          `行数=${options}, 期待=${props.activeQuestions.length}`
        );
      },
    },
    {
      id: 'selected-options-match-linked',
      description: 'aria-checked=true の行数が linkedCount と一致する',
      onlyFixtures: ['open'],
      check: ({ root, contract }) => {
        const selected = root.querySelectorAll(
          '[role="menuitemcheckbox"][aria-checked="true"]',
        ).length;
        return (
          selected === Number(contract.linkedCount) ||
          `aria-checked=${selected} だが linkedCount=${contract.linkedCount}`
        );
      },
    },
    {
      id: 'every-linked-question-is-shown',
      // 先頭だけ出して残りを「+n」に畳んでいた頃は、畳んだ数字から
      // 「どの問いを結んだのか」が分からなかった。全部並べる。
      description: '結ばれている問いは、数だけでなく全部が並ぶ',
      check: ({ root, contract }) => {
        const chips = root.querySelectorAll(
          '[data-verify-unit="QuestionChip"] button[aria-label^="「"]',
        ).length;
        const expected = Number(contract.linkedCount);
        return chips === expected || `並んでいるチップ=${chips}, 結ばれた数=${expected}`;
      },
    },
    {
      id: 'overflow-scrolls-sideways',
      // 縦に折り返すとヘッダーの高さが動き、本文の始まる位置がずれる。
      description: 'あふれたら横に流す（折り返さない）',
      check: ({ root }) => {
        const row = root.querySelector('[data-verify-unit="QuestionChip"] > div');
        if (!row) return 'チップの並びが見つからない';
        return row.className.includes('overflow-x-auto') || `横に流す指定が無い: ${row.className}`;
      },
    },
    {
      id: 'each-chip-says-what-it-does',
      // チップを押すと紐づけが外れる。押す前にそれが分かる必要がある。
      // 翻訳キーの入れ忘れもここで落ちる（未定義なら生キーが出る）。
      description: '結ばれたチップは、外す操作であることを読み上げに伝える',
      check: ({ root, contract }) => {
        const chips = Array.from(
          root.querySelectorAll('[data-verify-unit="QuestionChip"] button[aria-label^="「"]'),
        );
        if (chips.length !== Number(contract.linkedCount)) {
          return `チップ=${chips.length}, 結ばれた数=${contract.linkedCount}`;
        }
        const bad = chips.find((c) => (c.getAttribute('aria-label') ?? '').includes('unlink_aria'));
        return (
          bad === undefined || `翻訳キーが解決されていない: "${bad.getAttribute('aria-label')}"`
        );
      },
    },
    {
      id: 'panel-is-not-clipped-by-the-row',
      // 結ばれた問いの行は横に流れる（overflow）。「足す」チップと面をその中に置くと、
      // 開いた面が行の枠で切られる。
      description: '開いた面は、横に流れる行の外側で開く',
      onlyFixtures: ['open'],
      check: ({ root }) => {
        const panel = root.querySelector('[role="menu"]');
        if (!panel) return '面が開いていない';
        return (
          panel.closest('.overflow-x-auto') === null ||
          '面が横スクロールの内側にある（枠で切られる）'
        );
      },
    },
  ],
});
