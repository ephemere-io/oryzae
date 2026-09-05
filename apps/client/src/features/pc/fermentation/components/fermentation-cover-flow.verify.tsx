/**
 * FermentationCoverFlow の検証スペック（発酵履歴のオーバーレイ）。
 *
 * データ取得は持たない。発酵の一覧（results）も詳細（details）も props で受け取るので、
 * 何も注入せずに孤立検証できる。useTranslations は withVerifyProviders が供給する。
 * 内部 state はキャンバスの実測サイズだけで、jsdom では rect が 0 のため既定値
 * （1280×800）のまま描かれる ＝ fixture 間で変化しないので契約には出さない。
 *
 * 公表する契約: open / total / index / dragging / hasActiveDetail / unread。
 *
 * この部品の要は 3 つ。(1) 円盤の枚数が発酵の件数と一致すること、(2) 正面がちょうど 1 枚で
 * あること、(3) 日付レールと円盤が同じ段を指していること。どれかがずれると「めくったのに
 * 別の回が開く」になる。invariants でそこを縛る。
 *
 * probe は 2 つ。発酵 0 件（履歴に入れない問い ＝ open=false に落ちる）と、発酵 1 件
 * （両端の矢印が同時に無効。円盤 1 枚・レール 1 項目で成立するか）。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail, FermentationSummary } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { FermentationCoverFlow } from './fermentation-cover-flow';

interface Props {
  questionId: string | null;
  questionText: string;
  results: readonly FermentationSummary[];
  index: number;
  details: ReadonlyMap<string, FermentationDetail>;
  unreadFermentationIds: ReadonlySet<string>;
  innerOverrides: {
    keywords: Record<string, { jarX: number; jarY: number }>;
    snippets: Record<string, { jarX: number; jarY: number }>;
    letters: Record<string, { jarX: number; jarY: number }>;
  };
  onInnerDragMove: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    x: number,
    y: number,
  ) => void;
  onInnerDragEnd: (
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    x: number,
    y: number,
  ) => void;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onElementClick: (
    resultId: string,
    type: 'keyword' | 'snippet' | 'letter',
    id: string,
    data: Record<string, string>,
  ) => void;
  selectedElementId: string | null;
}

const noop = () => {};

function summary(id: string, createdAt: string, period: string): FermentationSummary {
  return { id, questionId: 'q-1', status: 'completed', createdAt, targetPeriod: period };
}

const FOUR: FermentationSummary[] = [
  summary('f-a', '2026-06-15T02:00:00.000Z', 'WEEK 24'),
  summary('f-b', '2026-06-29T02:00:00.000Z', 'WEEK 26'),
  summary('f-c', '2026-07-20T02:00:00.000Z', 'WEEK 29'),
  summary('f-d', '2026-08-31T02:00:00.000Z', 'WEEK 35'),
];

const DETAIL: FermentationDetail = {
  id: 'f-d',
  questionId: 'q-1',
  targetPeriod: 'WEEK 35',
  status: 'completed',
  worksheet: null,
  keywords: [
    { id: 'k-1', keyword: '速度差', description: 'ずれを認めておく', jarX: null, jarY: null },
  ],
  snippets: [
    {
      id: 's-1',
      snippetType: 'core',
      originalText: '急がなくていい日を、自分で決めていないだけかもしれない',
      sourceDate: '2026-08-27',
      selectionReason: '同じことを別の側から書いている',
      jarX: null,
      jarY: null,
    },
  ],
  letter: {
    id: 'l-1',
    bodyText: '二か月半で、この問いはかたちを変えました。',
    jarX: null,
    jarY: null,
  },
  scannedEntries: [
    { id: 'e-1', title: '八月の終わり', createdAt: '2026-08-27' },
    { id: 'e-2', title: '急がない日', createdAt: '2026-08-24' },
  ],
};

const base = {
  questionText: 'なぜ私は急ぐのが苦手なのか',
  innerOverrides: { keywords: {}, snippets: {}, letters: {} },
  onInnerDragMove: noop,
  onInnerDragEnd: noop,
  onIndexChange: noop,
  onClose: noop,
  onElementClick: noop,
  selectedElementId: null,
  unreadFermentationIds: new Set<string>(),
};

registerUnit<Props>({
  id: 'FermentationCoverFlow',
  title: 'FermentationCoverFlow',
  description: '発酵履歴（問いごとの過去の発酵を Cover Flow でめくる）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<FermentationCoverFlow {...props} />),
  fixtures: [
    {
      id: 'latest-front',
      description: '発酵4件・最新（末尾）が正面。左に過去3件が扇状に並ぶ',
      props: {
        ...base,
        questionId: 'q-1',
        results: FOUR,
        index: 3,
        details: new Map([['f-d', DETAIL]]),
      },
    },
    {
      id: 'middle-front',
      description: '真ん中の段が正面（左右に円盤が出る）',
      props: {
        ...base,
        questionId: 'q-1',
        results: FOUR,
        index: 1,
        details: new Map(),
      },
    },
    {
      id: 'oldest-front',
      description: '最古が正面（前へ戻る矢印が無効になる）',
      props: {
        ...base,
        questionId: 'q-1',
        results: FOUR,
        index: 0,
        details: new Map(),
      },
    },
    {
      id: 'unread',
      description: '未読の発酵を含む（レールと円盤が未読色になる）',
      props: {
        ...base,
        questionId: 'q-1',
        results: FOUR,
        index: 3,
        details: new Map([['f-d', DETAIL]]),
        unreadFermentationIds: new Set(['f-d']),
      },
    },
    {
      id: 'closed',
      description: '閉じている（questionId=null。円盤もクロームも出ない）',
      props: {
        ...base,
        questionId: null,
        results: [],
        index: 0,
        details: new Map(),
      },
    },
    {
      id: 'single-result',
      probe: true,
      description: 'Probe: 発酵1件（円盤1枚・レール1項目・両端の矢印が同時に無効）',
      props: {
        ...base,
        questionId: 'q-1',
        results: [FOUR[3]],
        index: 0,
        details: new Map([['f-d', DETAIL]]),
      },
    },
    {
      id: 'no-results',
      probe: true,
      description: 'Probe: 問いは指定されているが発酵0件（履歴に入らず open=false へ落ちる）',
      props: {
        ...base,
        questionId: 'q-1',
        results: [],
        index: 0,
        details: new Map(),
      },
    },
    {
      id: 'index-out-of-range',
      probe: true,
      description: 'Probe: index が件数を超えている（末尾へクランプされ、円盤は崩れない）',
      props: {
        ...base,
        questionId: 'q-1',
        results: FOUR,
        index: 99,
        details: new Map(),
      },
    },
  ],
  invariants: [
    {
      id: 'disc-count-matches-total',
      description: '円盤の枚数が contract.total（＝発酵の件数）と一致する',
      check: ({ root, contract }) => {
        const discs = root.querySelectorAll('[data-verify-unit="HistoryDisc"]').length;
        return (
          String(discs) === contract.total ||
          `円盤=${discs} だが contract.total="${contract.total}"`
        );
      },
    },
    {
      id: 'exactly-one-active-disc',
      description: '正面の円盤はちょうど1枚（0枚なら中身が出ず、2枚なら重なって読めない）',
      check: ({ root, contract }) => {
        const active = root.querySelectorAll(
          '[data-verify-unit="HistoryDisc"][data-verify-active="true"]',
        ).length;
        const expected = contract.open === 'true' ? 1 : 0;
        return (
          active === expected ||
          `正面の円盤=${active} だが open="${contract.open}" では ${expected} 枚であるべき`
        );
      },
    },
    {
      id: 'rail-matches-results',
      description: '日付レールの項目数が発酵の件数と一致する（飛べない段を作らない）',
      check: ({ root, contract }) => {
        const rail = root.querySelectorAll('[data-verify-part="rail-item"]').length;
        const expected = contract.open === 'true' ? Number(contract.total) : 0;
        return (
          rail === expected ||
          `レール項目=${rail} だが expected=${expected}（total=${contract.total}）`
        );
      },
    },
    {
      id: 'index-within-range',
      description: '正面の段は必ず 0..total-1 に収まる（範囲外の index を渡されてもクランプする）',
      check: ({ contract }) => {
        const index = Number(contract.index);
        const total = Number(contract.total);
        if (total === 0) return index === 0 || `total=0 なのに index=${index}`;
        return (index >= 0 && index < total) || `index=${index} が 0..${total - 1} の外に出ている`;
      },
    },
    {
      id: 'chrome-iff-open',
      description: '「瓶にもどる」は開いているときだけ出る',
      check: ({ root, contract }) => {
        const hasBack = Boolean(root.textContent?.includes('瓶にもどる'));
        const expected = contract.open === 'true';
        return (
          hasBack === expected ||
          `戻るボタン present=${hasBack} だが contract.open="${contract.open}"`
        );
      },
    },
    {
      id: 'no-results-is-closed',
      description: '発酵0件の問いは履歴に入らない（open=false）',
      onlyFixtures: ['no-results', 'closed'],
      check: ({ contract }) =>
        contract.open === 'false' ||
        `発酵0件なのに contract.open="${contract.open}"（空の履歴を開いてはならない）`,
    },
    {
      id: 'single-result-still-opens',
      description: 'Probe: 発酵1件でも円盤1枚・レール1項目で成立する',
      onlyFixtures: ['single-result'],
      check: ({ root, contract }) => {
        const discs = root.querySelectorAll('[data-verify-unit="HistoryDisc"]').length;
        const rail = root.querySelectorAll('[data-verify-part="rail-item"]').length;
        return (
          (contract.open === 'true' && discs === 1 && rail === 1) ||
          `open=${contract.open}, 円盤=${discs}, レール=${rail}（すべて 1 であるべき）`
        );
      },
    },
    {
      id: 'out-of-range-clamps-to-last',
      description: 'Probe: 範囲外の index は末尾へクランプされる',
      onlyFixtures: ['index-out-of-range'],
      check: ({ contract }) =>
        contract.index === String(Number(contract.total) - 1) ||
        `index=${contract.index} だが total=${contract.total} なので ${Number(contract.total) - 1} へ寄せるべき`,
    },
    {
      id: 'scanned-count-waits-for-detail',
      description: '走査件数は詳細が届いてから出す（0 ENTRIES と嘘をつかない）',
      check: ({ root, contract }) => {
        const shows = Boolean(root.textContent?.includes('ENTRIES SCANNED'));
        const expected = contract.open === 'true' && contract.hasActiveDetail === 'true';
        return (
          shows === expected ||
          `ENTRIES SCANNED present=${shows} だが open=${contract.open} / hasActiveDetail=${contract.hasActiveDetail}`
        );
      },
    },
  ],
});
