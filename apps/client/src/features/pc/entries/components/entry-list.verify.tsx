/**
 * EntryList の検証スペック（PC 版エントリ一覧）。SP の双子 sp-entry-list.verify と同思想。
 *
 * データ取得は useEntries(api, search?, questionId?) と useDeleteEntry(api) に集約され、
 * どちらも api を引数に取り `api=null` で effect/呼び出しが early-return する。useEntries は
 * loading 初期値が true で、api 無しでは解決しないため一覧/空/エラー分岐に到達しない。よって:
 *  - loading 状態は `api=null` で純レンダリングできる（fetch ゼロ・検索バー＋スケルトンだけ）。
 *  - 空表示・一覧表示は `fetch` が同期解決する偽 ApiClient を渡し、act の wait で microtask を
 *    排出して loading=false に落とす。
 *  - エラー（probe）は `res.ok=false`（status 500）を返す偽 ApiClient で error=true に落とす。
 *
 * router(useRouter/usePathname) と i18n（entries.list）は withVerifyProviders が供給するため
 * クラッシュしない（EntryCard 内の next/link も Router context があれば描画できる）。
 *
 * 公表する契約は孤立検証で実際に変化する状態のみ: loading / count / hasQuestions / error。
 * availableQuestions は props 由来で hasQuestions を直接ゲートする。isSearching/isFiltering は
 * 孤立検証では常に未設定（検索は 300ms デバウンス＋再 fetch を経ないと反映されない・問いも
 * 未選択）で定数のため契約に載せない。検索 probe は searchInput 同期反映で出るクリアボタンの
 * 有無だけを観測する（debounce 非依存）。
 *
 * 注: PC 版は <ul>/<li> を使わず EntryCard を <div data-verify-unit="EntryCard"> として描画する
 * （flat/grouped どちらでも entry 1件＝カード1枚）。よって count は EntryCard 契約要素を数える。
 */

import { registerUnit } from '@oryzae/verify';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { EntryList, type FilterableQuestion } from './entry-list';

interface Props {
  api: ApiClient | null;
  authLoading: boolean;
  availableQuestions?: FilterableQuestion[];
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

const sampleQuestions: FilterableQuestion[] = [
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
    userId: 'u-1',
    content: '夜の振り返り\n今日は集中できた一日だった',
    mediaUrls: [],
    createdAt: '2026-06-18T21:30:00.000Z',
    updatedAt: '2026-06-18T21:30:00.000Z',
    linkedQuestions: [],
  },
];

/** 即 resolve する偽 ApiClient。fetch(path, init?) は ApiClient.fetch に代入可（as 不要）。 */
function makeApi(entries: FakeEntry[]): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify(entries), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
  };
}

/** 取得失敗（res.ok=false）を返す偽 ApiClient。error=true → ErrorState に落とす adversarial 用。 */
const failingApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: () => Promise.resolve(new Response('', { status: 500 })),
};

const emptyApi = makeApi([]);
const populatedApi = makeApi(sampleEntries);

registerUnit<Props>({
  id: 'EntryList',
  title: 'EntryList',
  description: 'PC 版エントリ一覧（検索・問いフィルタ・月/週グルーピング・削除確認）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryList {...props} />),
  fixtures: [
    {
      id: 'loading',
      description: '読み込み中（api 未確定）は検索バーとスケルトンだけ・一覧/空/エラーは出さない',
      props: { api: null, authLoading: false, availableQuestions: sampleQuestions },
    },
    {
      id: 'empty',
      description: '取得結果が空ならエントリ無しの空メッセージを出す（count=0・error=false）',
      props: { api: emptyApi, authLoading: false },
      act: async (ctx) => {
        await ctx.wait(50);
      },
    },
    {
      id: 'populated',
      description: 'エントリ2件と問いフィルタ select を描画する（count=2・hasQuestions=true）',
      props: { api: populatedApi, authLoading: false, availableQuestions: sampleQuestions },
      act: async (ctx) => {
        await ctx.wait(50);
      },
    },
    {
      id: 'search-typed',
      description:
        '検索に文字を入れるとクリアボタンが現れる（searchInput 同期反映・debounce 非依存）',
      props: { api: populatedApi, authLoading: false },
      act: async (ctx) => {
        await ctx.wait(50);
        await ctx.type('input[type="text"]', '散歩');
        await ctx.wait(16);
      },
    },
    {
      id: 'fetch-error',
      probe: true,
      description: 'Probe: 取得失敗（res.ok=false）で空状態でも崩れず ErrorState＋再試行を出す',
      props: { api: failingApi, authLoading: false },
      act: async (ctx) => {
        await ctx.wait(50);
      },
    },
  ],
  invariants: [
    {
      id: 'count-matches-entry-cards',
      description: 'contract.count が描画された EntryCard 契約要素の数と一致する',
      check: ({ root, contract }) => {
        const cards = root.querySelectorAll('[data-verify-unit="EntryCard"]').length;
        return (
          contract.count === String(cards) ||
          `contract.count="${contract.count}" だが EntryCard 描画数=${cards}`
        );
      },
    },
    {
      id: 'has-questions-iff-filter-select',
      description: '問いフィルタ select は hasQuestions=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasSelect = Boolean(root.querySelector('#entries-question-filter'));
        const claimed = contract.hasQuestions === 'true';
        return (
          hasSelect === claimed ||
          `filter select present=${hasSelect} だが contract.hasQuestions="${contract.hasQuestions}"`
        );
      },
    },
    {
      id: 'error-state-iff-contract-error',
      description:
        'ErrorState（data-testid=error-state）は contract.error=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasError = Boolean(root.querySelector('[data-testid="error-state"]'));
        const claimed = contract.error === 'true';
        return (
          hasError === claimed ||
          `error-state present=${hasError} だが contract.error="${contract.error}"`
        );
      },
    },
    {
      id: 'empty-message-when-loaded-empty',
      description: '読み込み完了かつ count=0 かつ error=false のときだけ空メッセージを出す',
      check: ({ root, contract }) => {
        const showsEmpty = Boolean(root.textContent?.includes('エントリーはまだありません'));
        const expectEmpty =
          contract.loading === 'false' && contract.count === '0' && contract.error === 'false';
        return (
          showsEmpty === expectEmpty ||
          `空メッセージ present=${showsEmpty} だが loading=${contract.loading}, count=${contract.count}, error=${contract.error}`
        );
      },
    },
    {
      id: 'loading-shows-skeleton-not-list',
      description: '読み込み中はスケルトンだけ・一覧（EntryCard）も空/エラーメッセージも出さない',
      onlyFixtures: ['loading'],
      check: ({ root, contract }) => {
        const hasSkeleton = Boolean(root.querySelector('[data-testid="entry-list-skeleton"]'));
        const hasCards = Boolean(root.querySelector('[data-verify-unit="EntryCard"]'));
        const showsEmpty = Boolean(root.textContent?.includes('エントリーはまだありません'));
        return (
          (contract.loading === 'true' && hasSkeleton && !hasCards && !showsEmpty) ||
          `loading=${contract.loading}, skeleton=${hasSkeleton}, cards=${hasCards}, emptyMsg=${showsEmpty}`
        );
      },
    },
    {
      id: 'populated-renders-both-entries',
      description: '一覧は2件描画し、各エントリの本文タイトルが現れる',
      onlyFixtures: ['populated'],
      check: ({ root, contract }) => {
        const text = root.textContent ?? '';
        if (contract.count !== '2') return `expected count=2, got "${contract.count}"`;
        if (!text.includes('朝の散歩')) return 'エントリ「朝の散歩」が描画されていない';
        return text.includes('夜の振り返り') || 'エントリ「夜の振り返り」が描画されていない';
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
      id: 'fetch-error-shows-retry',
      description: '取得失敗時は再試行ボタン（再読み込み）を出す',
      onlyFixtures: ['fetch-error'],
      check: ({ root, contract }) => {
        if (contract.error !== 'true') return `expected error=true, got "${contract.error}"`;
        return (
          Boolean(root.textContent?.includes('再読み込み')) ||
          'エラー時に再試行ボタンが描画されていない'
        );
      },
    },
  ],
});
