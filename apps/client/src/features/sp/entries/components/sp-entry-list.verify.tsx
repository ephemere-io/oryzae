/**
 * SpEntryList の検証スペック（A 移植・SP 版エントリ一覧）。
 *
 * データ取得は2フックに集約される: useActiveQuestions(api, false)（問いチップ）と
 * useEntries(api, search?, questionId?, order?)（一覧）。どちらも api を引数に取り、`api=null` で
 * effect が early-return する。ただし useEntries は loading の初期値が true で、api 無しでは
 * 解決しないため loading=true のまま一覧/空表示の分岐に到達しない。よって:
 *  - loading 状態は `api=null` で純レンダリングできる（fetch ゼロ）。
 *  - 空表示・一覧表示・問いチップは `fetch` が同期解決する偽 ApiClient を渡し、act の
 *    wait で microtask を排出して loading=false に落とす（neverResolve の逆: 即 resolve）。
 *
 * router(useRouter) は withVerifyProviders が AppRouterContext に no-op を供給するため
 * クラッシュしない（タップの router.push も副作用ゼロ）。i18n（sp.list）依存も同 provider
 * の NextIntlClientProvider で満たす。
 *
 * 公表する契約は実際に変化する状態のみ: loading / count / hasQuestions / order。order は
 * ソートトグル（新しい順⇄古い順）でユーザーが切り替えられる状態なので契約に載せる。filtering は
 * 検索/問いフィルタが孤立検証で常に未設定（debounce 非依存・チップ未クリック）になり定数の
 * ため契約に載せない。検索の 300ms デバウンスには依存しない（初回 fetch は api 変化で発火し
 * debounce を通らない。検索 probe は searchInput 同期反映で出るクリアボタンの有無だけを観測する）。
 */

import { registerUnit } from '@oryzae/verify';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpEntryList } from './sp-entry-list';

interface Props {
  api: ApiClient | null;
}

interface FakeEntry {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  linkedQuestions: Array<{ id: string; currentText: string | null }>;
}

const sampleQuestions = [
  { id: 'q-1', currentText: '最近うれしかったこと' },
  { id: 'q-2', currentText: 'いま気がかりなこと' },
];

const sampleEntries: FakeEntry[] = [
  {
    id: 'entry-1',
    userId: 'u-1',
    content: '朝の散歩\n冷たい空気が気持ちよかった',
    mediaUrls: [],
    createdAt: '2026-06-20T08:00:00.000Z',
    updatedAt: '2026-06-20T08:00:00.000Z',
    linkedQuestions: [{ id: 'q-1', currentText: '最近うれしかったこと' }],
  },
  {
    id: 'entry-2',
    // 先頭行が空 → firstLine フォールバックで t('untitled')（無題）になる adversarial 行。
    userId: 'u-1',
    content: '\n本文だけのメモ',
    mediaUrls: [],
    createdAt: '2026-06-18T21:30:00.000Z',
    updatedAt: '2026-06-18T21:30:00.000Z',
    linkedQuestions: [],
  },
];

/** 即 resolve する偽 ApiClient。path で questions / entries を出し分ける（as 不要で型を満たす）。 */
function makeApi(entries: FakeEntry[], questions: typeof sampleQuestions): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: (path: string) => {
      const body = path.startsWith('/api/v1/questions') ? questions : entries;
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    },
  };
}

const emptyApi = makeApi([], []);
const populatedApi = makeApi(sampleEntries, sampleQuestions);

registerUnit<Props>({
  id: 'SpEntryList',
  title: 'SpEntryList',
  description: 'SP 版エントリ一覧（検索・問いチップ絞り込み・タップで詳細遷移）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SpEntryList {...props} />),
  fixtures: [
    {
      id: 'loading',
      description: '読み込み中（api 未確定）はヘッダと検索だけ・一覧/空表示は出さない',
      props: { api: null },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 取得結果が空ならエントリ無しの空メッセージを出す（count=0）',
      props: { api: emptyApi },
      act: async (ctx) => {
        await ctx.wait(50);
      },
    },
    {
      id: 'populated',
      description: 'エントリと問いチップを描画する（count=2・hasQuestions=true）',
      props: { api: populatedApi },
      act: async (ctx) => {
        await ctx.wait(50);
      },
    },
    {
      id: 'search-typed',
      probe: true,
      description: 'Probe: 検索に文字を入れるとクリアボタンが現れる（searchInput 同期反映）',
      props: { api: populatedApi },
      act: async (ctx) => {
        await ctx.wait(50);
        await ctx.type('input[aria-label]', '散歩');
        await ctx.wait(16);
      },
    },
    {
      id: 'sort-toggled',
      probe: true,
      description: 'Probe: ソートトグルを押すと並び順が newest→oldest に切り替わる',
      props: { api: populatedApi },
      act: async (ctx) => {
        await ctx.wait(50);
        ctx.click('#sp-entries-sort-toggle');
        await ctx.wait(50);
      },
    },
  ],
  invariants: [
    {
      id: 'count-matches-list-items',
      description: 'contract.count が描画されたエントリ <li> の数と一致する',
      check: ({ root, contract }) => {
        const items = root.querySelectorAll('ul li').length;
        return (
          contract.count === String(items) ||
          `contract.count="${contract.count}" だが <li> 描画数=${items}`
        );
      },
    },
    {
      id: 'has-questions-iff-chips',
      description: '問いチップ（「すべて」チップ）は hasQuestions=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasChips = Boolean(root.querySelector('.overflow-x-auto button'));
        const claimed = contract.hasQuestions === 'true';
        return (
          hasChips === claimed ||
          `chips present=${hasChips} だが contract.hasQuestions="${contract.hasQuestions}"`
        );
      },
    },
    {
      id: 'empty-message-when-loaded-empty',
      description: '読み込み完了かつ count=0 のときだけ空メッセージを出す',
      check: ({ root, contract }) => {
        const showsEmpty = Boolean(root.textContent?.includes('まだエントリがありません'));
        const expectEmpty = contract.loading === 'false' && contract.count === '0';
        return (
          showsEmpty === expectEmpty ||
          `空メッセージ present=${showsEmpty} だが loading=${contract.loading}, count=${contract.count}`
        );
      },
    },
    {
      id: 'loading-shows-no-list-or-empty',
      description: '読み込み中は一覧（ul）も空メッセージも描画しない',
      onlyFixtures: ['loading'],
      check: ({ root, contract }) => {
        const hasList = Boolean(root.querySelector('ul'));
        const showsEmpty = Boolean(root.textContent?.includes('まだエントリがありません'));
        return (
          (contract.loading === 'true' && !hasList && !showsEmpty) ||
          `loading=${contract.loading}, ul=${hasList}, emptyMsg=${showsEmpty}`
        );
      },
    },
    {
      id: 'populated-renders-entries-and-untitled-fallback',
      description: '一覧は2件描画し、先頭行が空のエントリは「無題」をタイトルに使う',
      onlyFixtures: ['populated'],
      check: ({ root, contract }) => {
        const text = root.textContent ?? '';
        if (contract.count !== '2') return `expected count=2, got "${contract.count}"`;
        if (!text.includes('朝の散歩')) return 'エントリ「朝の散歩」が描画されていない';
        return text.includes('無題') || '先頭行が空のエントリで「無題」フォールバックが出ていない';
      },
    },
    {
      id: 'search-typed-shows-clear-button',
      description: '検索入力後はクリアボタン（aria-label=検索をクリア）が現れる',
      onlyFixtures: ['search-typed'],
      check: ({ root }) =>
        Boolean(root.querySelector('button[aria-label="検索をクリア"]')) ||
        '検索入力後にクリアボタンが現れていない',
    },
    {
      id: 'order-default-newest',
      description: 'ソート未操作の初期状態は order=newest（新しい順）',
      onlyFixtures: ['loading', 'empty', 'populated'],
      check: ({ contract }) =>
        contract.order === 'newest' ||
        `初期 order は 'newest' のはずだが contract.order="${contract.order}"`,
    },
    {
      id: 'sort-label-matches-order',
      description:
        'ソートトグルのラベルは現在の order を反映する（newest→新しい順 / oldest→古い順）',
      check: ({ root, contract }) => {
        const label = root.querySelector('#sp-entries-sort-toggle')?.textContent ?? '';
        if (contract.order === 'newest')
          return label.includes('新しい順') || `order=newest だがラベル="${label}"`;
        if (contract.order === 'oldest')
          return label.includes('古い順') || `order=oldest だがラベル="${label}"`;
        return `未知の order="${contract.order}"`;
      },
    },
    {
      id: 'sort-toggle-flips-to-oldest',
      description: 'トグル押下後は order=oldest になりラベルが「古い順」に変わる',
      onlyFixtures: ['sort-toggled'],
      check: ({ root, contract }) => {
        if (contract.order !== 'oldest')
          return `トグル後 order='oldest' のはずだが "${contract.order}"`;
        const label = root.querySelector('#sp-entries-sort-toggle')?.textContent ?? '';
        return label.includes('古い順') || 'トグル後にラベルが「古い順」になっていない';
      },
    },
  ],
});
