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
  open: boolean;
  entries: StudyEntry[];
  months: string[];
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
  onSelectEntry: (entry: StudyEntry) => void;
  onClose: () => void;
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
  ],
  invariants: [
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
      check: ({ root }) => {
        const labels = [...root.querySelectorAll('button[aria-pressed]')].map((b) =>
          b.textContent?.trim(),
        );
        return labels.includes('ALL') || 'ALL チップが無い';
      },
    },
    {
      id: 'one-chip-selected',
      description: '選択中のチップがちょうど 1 つ塗られている',
      check: ({ root }) => {
        const pressed = root.querySelectorAll('button[aria-pressed="true"]').length;
        return pressed === 1 || `選択中のチップが ${pressed} 個`;
      },
    },
  ],
});
