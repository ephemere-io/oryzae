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

const CHIP_SELECTOR = '[data-verify-unit="QuestionChip"] > button';

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
        await click(CHIP_SELECTOR);
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
      // 問いは**付け外し**なので menuitemcheckbox（単一選択の option ではない）。
      // 面と行は設定パネルの Select と同じ MenuPanel / MenuOption を使う。
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
      id: 'extra-count-is-legible',
      // 「+1」を薄い文字で添えていたときは、複数結ばれていることが読み取れなかった。
      description: '2つ以上結ばれていれば、余りの件数が独立した丸として出る',
      check: ({ root, contract }) => {
        const trigger = root.querySelector('[data-verify-unit="QuestionChip"] > button');
        const linkedCount = Number(contract.linkedCount);
        const badge = Array.from(trigger?.querySelectorAll('span') ?? []).find((el) =>
          /^\+\d+$/.test(el.textContent?.trim() ?? ''),
        );
        if (linkedCount <= 1) {
          return badge === undefined || `1件以下なのに余りの表示がある: "${badge.textContent}"`;
        }
        if (!badge) return `${linkedCount}件結ばれているのに余りの表示が無い`;
        return (
          badge.textContent?.trim() === `+${linkedCount - 1}` ||
          `余りの表示が "${badge.textContent}"（+${linkedCount - 1} であるべき）`
        );
      },
    },
    {
      id: 'multi-linked-is-announced',
      // 見た目の「+n」は読み上げに届かないので、そのときだけ件数を言う。
      // 翻訳キーの入れ忘れもここで落ちる（未定義なら生キーが出る）。
      description: '2つ以上結ばれていれば、件数が aria-label で言われる',
      check: ({ root, contract }) => {
        const trigger = root.querySelector('[data-verify-unit="QuestionChip"] > button');
        const label = trigger?.getAttribute('aria-label');
        if (Number(contract.linkedCount) <= 1) {
          return label === null || `1件以下なのに件数の読み上げが付いている: "${label}"`;
        }
        if (!label) return '複数結ばれているのに aria-label が無い';
        return (
          (label.includes(contract.linkedCount) && !label.includes('linked_count')) ||
          `aria-label が件数を伝えていない: "${label}"`
        );
      },
    },
    {
      id: 'panel-left-aligns-with-trigger',
      description: '開いた面の左端はチップの左端に合う（器がボタンに張りついている）',
      onlyFixtures: ['open'],
      check: ({ root }) => {
        const wrapper = root.querySelector('[data-verify-unit="QuestionChip"]');
        if (!wrapper) return '器が見つからない';
        return (
          wrapper.className.includes('inline-flex') ||
          `器が inline-flex でない（ヘッダー幅いっぱいに広がると面の左端がずれる）: ${wrapper.className}`
        );
      },
    },
  ],
});
