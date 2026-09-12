/**
 * EntryListOverlay の検証スペック。
 *
 * 「記録が無い月では空の行を並べず、無いと言う」「過去月から開いたらその月だけに絞る」
 * という受け入れ基準（40-acceptance.md「一覧オーバーレイ」）をここで見る。
 *
 * 閉じた状態（何も描かない）はここでは扱わない。dom-contract verifier は
 * `data-verify-*` を 1 つも出さないユニットを FAIL とするので、null を返す
 * fixture は原理的に置けない。閉じた挙動は素の unit test で見る。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import type { StudyEntry } from '../types';
import { EntryListOverlay } from './entry-list-overlay';

interface Props {
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  questions?: { id: string; currentText: string | null }[];
  questionId?: string | null;
  onSelectQuestion?: (questionId: string | null) => void;
  open: boolean;
  entries: StudyEntry[];
  months: string[];
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
  onSelectEntry: (entry: StudyEntry) => void;
  onCreateEntry?: () => void;
  onClose: () => void;
  variant?: 'paper' | 'mobile';
}

function entry(id: string, createdAt: string, overrides: Partial<StudyEntry> = {}): StudyEntry {
  return {
    id,
    createdAt,
    excerpt: '今日は静かだった。',
    chars: 120,
    linkedQuestions: [],
    pickled: false,
    ...overrides,
  };
}

const ENTRIES: StudyEntry[] = [
  entry('e1', '2026-09-02T01:00:00.000Z', {
    linkedQuestions: [{ id: 'q1', currentText: '続ける意味とは' }],
    pickled: true,
  }),
  entry('e2', '2026-09-01T01:00:00.000Z', { excerpt: '雨が降っていた。', chars: 64 }),
  entry('e3', '2026-08-20T01:00:00.000Z', { excerpt: '夏の終わりの匂い。', chars: 210 }),
];

const NOOP = {
  onSelectMonth: () => {},
  onSelectEntry: () => {},
  onCreateEntry: () => {},
  onClose: () => {},
};

registerUnit<Props>({
  id: 'EntryListOverlay',
  title: 'EntryListOverlay',
  description: '手帳の上にかぶさる記録の一覧（月チップつき）',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryListOverlay {...props} />),
  fixtures: [
    {
      id: 'all',
      description: '全月',
      props: {
        open: true,
        entries: ENTRIES,
        months: ['2026-09', '2026-08'],
        selectedMonth: null,
        ...NOOP,
      },
    },
    {
      id: 'month',
      description: '過去月に絞った状態（呼び出し側がその月ぶんを渡す）',
      props: {
        open: true,
        entries: [ENTRIES[2]],
        months: ['2026-09', '2026-08'],
        selectedMonth: '2026-08',
        ...NOOP,
      },
    },
    {
      id: 'empty-month',
      probe: true,
      description: 'Probe: 記録が無い月は空の行を並べず「ありません」と出す',
      props: {
        open: true,
        entries: [],
        months: ['2026-09', '2026-08', '2026-07'],
        selectedMonth: '2026-07',
        ...NOOP,
      },
    },
    {
      id: 'has-more',
      probe: true,
      description: 'Probe: 続きがあるときは「さらに読み込む」を出す（古い記録へ辿れる）',
      props: {
        open: true,
        entries: ENTRIES,
        months: ['2026-09', '2026-08'],
        selectedMonth: null,
        hasMore: true,
        onLoadMore: () => {},
        ...NOOP,
      },
    },
    {
      id: 'with-tools',
      probe: true,
      description: 'Probe: 検索と問いの絞り込みが出る',
      props: {
        open: true,
        entries: ENTRIES,
        months: ['2026-09', '2026-08'],
        selectedMonth: null,
        search: '',
        onSearchChange: () => {},
        questions: [
          { id: 'q1', currentText: '続ける意味とは' },
          { id: 'q2', currentText: null },
        ],
        questionId: 'q1',
        onSelectQuestion: () => {},
        ...NOOP,
      },
    },
    {
      id: 'loading-month',
      probe: true,
      description: 'Probe: その月を取りに行っている間は 0 件だと断定しない',
      props: {
        open: true,
        entries: [],
        months: ['2026-09', '2026-08', '2026-04'],
        selectedMonth: '2026-04',
        loading: true,
        ...NOOP,
      },
    },
    {
      id: 'mobile',
      probe: true,
      description:
        'Probe: 全画面の一覧（SP）。月と問いはドロップダウンに畳み、上段は閉じると新規作成の正円',
      props: {
        variant: 'mobile',
        open: true,
        entries: ENTRIES,
        months: ['2026-09', '2026-08', '2026-07', '2026-06'],
        selectedMonth: null,
        search: '',
        onSearchChange: () => {},
        questions: [
          { id: 'q1', currentText: '続ける意味とは' },
          { id: 'q2', currentText: null },
        ],
        questionId: 'q1',
        onSelectQuestion: () => {},
        ...NOOP,
      },
    },
  ],
  invariants: [
    {
      id: 'mobile-folds-filters-into-dropdowns',
      description: '全画面の一覧では、月と問いをチップで並べずドロップダウンに畳む',
      onlyFixtures: ['mobile'],
      check: ({ root }) => {
        const chips = root.querySelectorAll('[data-chip-group]').length;
        if (chips > 0) return `チップの帯が ${chips} 本残っている`;
        const boxes = root.querySelectorAll('[role="combobox"]').length;
        return boxes === 2 || `ドロップダウンが ${boxes} 個（期待: 月と問いの 2 個）`;
      },
    },
    {
      id: 'mobile-round-buttons',
      description: '全画面の一覧の上段は、左に閉じる・右に新規作成の正円',
      onlyFixtures: ['mobile'],
      check: ({ root }) => {
        const close = root.querySelector('button[aria-label="閉じる"]');
        const create = root.querySelector('[data-verify-part="create-entry"]');
        if (!(close instanceof HTMLElement) || !(create instanceof HTMLElement))
          return '閉じるか新規作成が無い';
        const round = (el: HTMLElement) =>
          el.classList.contains('rounded-full') && el.classList.contains('h-11');
        return (round(close) && round(create)) || '上段のボタンが正円でない';
      },
    },
    {
      id: 'offers-a-new-entry',
      description: '一覧から新しく書き始められる（今月の手帳を開いた先に書く入口がある）',
      check: ({ root, props }) => {
        if (!props.onCreateEntry) return true;
        return (
          root.querySelector('[data-verify-part="create-entry"]') !== null || '「新規作成」が無い'
        );
      },
    },
    {
      id: 'rows-are-what-was-given',
      description: '渡された記録をそのまま出す（手元でもう一度絞らない）',
      check: ({ root, props }) => {
        // 手元で絞ると UTC の月で判定することになり、月初の記録を落とす。
        const expected = props.loading ? 0 : props.entries.length;
        const rows = root.querySelectorAll('li').length;
        return rows === expected || `行数不一致: expected=${expected} actual=${rows}`;
      },
    },
    {
      id: 'load-more-only-when-more',
      description: '「さらに読み込む」は続きがあるときだけ出す',
      check: ({ root, contract }) => {
        const shown = (root.textContent ?? '').includes('さらに読み込む');
        return (
          shown === (contract.hasMore === 'true') ||
          `ボタン=${shown} だが hasMore="${contract.hasMore}"`
        );
      },
    },
    {
      id: 'question-filter-is-single-choice',
      description: '問いの絞り込みはちょうど 1 つ選ばれている（すべて or ひとつ）',
      onlyFixtures: ['with-tools'],
      check: ({ root }) => {
        // 月のチップと問いのチップが両方あるので、押されているのは 2 つ（月=ALL と 問い）。
        const pressed = root.querySelectorAll(
          '[data-chip-group="question"] button[aria-pressed="true"]',
        ).length;
        return pressed === 1 || `押されている問いのチップが ${pressed} 個（期待: 1）`;
      },
    },
    {
      id: 'search-box-when-supported',
      description: '検索が使えるときだけ入力欄を出す',
      check: ({ root, props }) => {
        const hasInput = root.querySelector('input') !== null;
        return (
          hasInput === (props.onSearchChange !== undefined) ||
          `入力欄=${hasInput} だが onSearchChange=${props.onSearchChange !== undefined}`
        );
      },
    },
    {
      id: 'loading-does-not-claim-empty',
      description: '取りに行っている間は「ありません」と断定しない',
      onlyFixtures: ['loading-month'],
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return !text.includes('この月の記録はありません') || '取得中なのに 0 件だと断定している';
      },
    },
    {
      id: 'empty-month-message',
      description: '該当が 0 件なら空行ではなくメッセージを出す',
      check: ({ root, contract }) => {
        if (contract.rowCount !== '0') return true;
        return root.querySelectorAll('li').length === 0 || '0 件なのに行が並んでいる';
      },
    },
    {
      id: 'all-chip-always-present',
      description: 'ALL チップが常にある（全月へ戻れる）',
      onlyFixtures: ['all', 'month', 'empty-month', 'has-more', 'with-tools', 'loading-month'],
      check: ({ root }) => {
        const labels = [...root.querySelectorAll('button[aria-pressed]')].map((b) =>
          b.textContent?.trim(),
        );
        return labels.includes('ALL') || 'ALL チップが無い';
      },
    },
    {
      id: 'one-chip-selected',
      description: '月のチップは常にちょうど 1 つ塗られている',
      onlyFixtures: ['all', 'month', 'empty-month', 'has-more', 'with-tools', 'loading-month'],
      check: ({ root }) => {
        // 問いのチップも同じ形なので、月の帯に限って数える。
        const pressed = root.querySelectorAll(
          '[data-chip-group="month"] button[aria-pressed="true"]',
        ).length;
        return pressed === 1 || `選択中のチップが ${pressed} 個`;
      },
    },
  ],
});
