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
  paneOpen: boolean;
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

/** 20 件超の履歴。レールがはみ出し、円盤が埋もれていた条件（レビュー報告）。 */
const MANY: FermentationSummary[] = Array.from({ length: 21 }, (_, i) =>
  summary(
    `m-${i}`,
    `2026-${String(4 + Math.floor(i / 8)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T02:00:00.000Z`,
    `WEEK ${14 + i}`,
  ),
);

const base = {
  questionText: 'なぜ私は急ぐのが苦手なのか',
  innerOverrides: { keywords: {}, snippets: {}, letters: {} },
  onInnerDragMove: noop,
  onInnerDragEnd: noop,
  onIndexChange: noop,
  onClose: noop,
  paneOpen: false,
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
      id: 'many-middle',
      description: '履歴21件・真ん中を閲覧中（レールは窓で切り、前後に … を出す）',
      props: {
        ...base,
        questionId: 'q-1',
        results: MANY,
        index: 10,
        details: new Map(),
      },
    },
    {
      id: 'many-latest',
      probe: true,
      description: 'Probe: 履歴21件・最新を閲覧中（窓が末尾へ寄り、後ろの … は出ない）',
      props: {
        ...base,
        questionId: 'q-1',
        results: MANY,
        index: 20,
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
      id: 'rail-is-windowed',
      description:
        'レールは 9 件までに切る（全件並べると列からはみ出し、右の詳細列に重なっていた）',
      check: ({ root, contract }) => {
        const rail = root.querySelectorAll('[data-verify-part="rail-item"]').length;
        const total = Number(contract.total);
        const expected = contract.open === 'true' ? Math.min(total, 9) : 0;
        return (
          rail === expected || `レール項目=${rail} だが expected=${expected}（total=${total}）`
        );
      },
    },
    {
      id: 'rail-shows-more-when-truncated',
      description: '切ったぶんは「…」で続きがあることを示す',
      check: ({ root, contract }) => {
        const rail = root.querySelectorAll('[data-verify-part="rail-item"]').length;
        const more = root.querySelectorAll('[data-verify-part="rail-more"]').length;
        const truncated = contract.open === 'true' && Number(contract.total) > rail;
        return (
          (truncated ? more > 0 : more === 0) ||
          `… の数=${more} だが truncated=${truncated}（total=${contract.total} / 表示=${rail}）`
        );
      },
    },
    {
      id: 'active-date-stays-in-the-rail',
      description: 'いま見ている段は必ずレールの中にある（窓の外に出ると現在地が見えなくなる）',
      check: ({ root, contract }) => {
        if (contract.open !== 'true') return true;
        const active = root.querySelectorAll(
          '[data-verify-part="rail-item"][data-verify-rail-active="true"]',
        ).length;
        return active === 1 || `窓の中の選択中チップ=${active}（1 つであるべき）`;
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
      id: 'rail-is-the-only-status-line',
      description: '日付・順序を語るのは日付レールだけ（進捗や走査件数を文章で言い直さない）',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        const echoes = ['FERMENTATION HISTORY', 'ENTRIES SCANNED', 'の発酵（'].filter((phrase) =>
          text.includes(phrase),
        );
        return echoes.length === 0 || `レールと同じ内容を文章でも出している: ${echoes.join(' / ')}`;
      },
    },
    {
      id: 'exactly-one-active-rail-item',
      description: 'レールで選ばれているチップはちょうど1つ（円盤の正面と対応する）',
      check: ({ root, contract }) => {
        const active = root.querySelectorAll(
          '[data-verify-part="rail-item"][data-verify-rail-active="true"]',
        ).length;
        const expected = contract.open === 'true' ? 1 : 0;
        return (
          active === expected ||
          `選択中のチップ=${active} だが open="${contract.open}" では ${expected} 個であるべき`
        );
      },
    },
    {
      id: 'newest-marker-on-the-last-item',
      description: '「最新」の印は右端のチップだけに付く（どちら向きが新しいか常に分かる）',
      onlyFixtures: ['latest-front', 'middle-front', 'oldest-front', 'many-latest'],
      check: ({ root }) => {
        const items = [...root.querySelectorAll('[data-verify-part="rail-item"]')];
        const marked = items.filter((el) => (el.textContent ?? '').includes('最新'));
        const last = items[items.length - 1];
        return (
          (marked.length === 1 && marked[0] === last) ||
          `「最新」の印が ${marked.length} 個（右端に1つだけであるべき）`
        );
      },
    },
  ],
});
