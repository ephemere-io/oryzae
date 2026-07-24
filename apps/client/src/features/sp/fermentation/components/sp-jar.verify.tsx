/**
 * SpJar の検証スペック（SP 版「瓶」= 発酵の結果を読む場所・Issue #363）。
 *
 * データ取得は useFermentationInbox / useFermentationDetail がともに `api` を引数に取り、
 * `api=null` で early-return する seam を持つ。ただし inbox は loading=useState(true) で開始し
 * setLoading(false) が fetch 完了後にしか走らないため、api=null だと loading=true に張り付き
 * ヘッダのみ描画になる（有効な描画状態だが契約が薄い）。よって「fetch を解決する」偽 ApiClient を
 * 注入して受信箱の状態機械（empty / 一覧 / 開封）を孤立再現する。new Response(body,{status:200}) で
 * .ok と .json() が成立する（as / any 不要）。
 *
 * router(useRouter) は withVerifyProviders が no-op を供給するため返信ボタンの push も副作用なし。
 * useUnread() は UnreadContext の default 値（markSeen=no-op）で provider 無しでもクラッシュしない。
 * i18n（sp.jar）依存のため withVerifyProviders（NextIntlClientProvider）で包む。
 *
 * 公表する契約は実際に変化する状態のみ: loading / letterCount / open。受信箱は /questions と
 * バルク /fermentations（questionId なし・#363 で N+1 解消）を並行取得して setLetters するため
 * microtask チェーンが残る。データ駆動 fixture は act で wait してから契約を読む。
 */

import { registerUnit } from '@oryzae/verify';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpJar } from './sp-jar';

interface Props {
  api: ApiClient | null;
}

const questionsJson = [{ id: 'q-1', currentText: '最近うれしかったことは？' }];

const summaryJson = [
  { id: 'f-1', questionId: 'q-1', status: 'completed', createdAt: '2026-06-20T00:00:00.000Z' },
];

const detailJson = {
  letter: { bodyText: 'あなたの言葉から、静かな喜びが立ち上っています。' },
  keywords: [{ id: 'k-1', keyword: '感謝', description: '' }],
  snippets: [
    { id: 's-1', originalText: '朝の光がきれいだった', sourceDate: '2026-06-18T00:00:00.000Z' },
  ],
};

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

/** fetch を解決して受信箱を満たす偽 ApiClient（手紙1通＋詳細）。as/any 不要で型を満たす。 */
const filledApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: (path) => {
    // 詳細(/fermentations/:id) を先に判定 → バルク一覧(/fermentations, questionId なし) → questions。
    if (path.includes('/fermentations/')) return jsonResponse(detailJson);
    if (path.includes('/fermentations')) return jsonResponse(summaryJson);
    return jsonResponse(questionsJson);
  },
};

/** /questions は空配列。受信箱は空（empty メッセージ）になる。 */
const emptyApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: () => jsonResponse([]),
};

registerUnit<Props>({
  id: 'SpJar',
  title: 'SpJar',
  description: 'SP 版「瓶」: 届いた発酵（手紙）を一覧→タップで手紙・言葉・抜粋を読む→返事を書く。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SpJar {...props} />),
  fixtures: [
    {
      id: 'empty',
      description: '届いた手紙が無い（empty メッセージ・letterCount=0）',
      props: { api: emptyApi },
      act: async (ctx) => {
        await ctx.wait(32);
      },
    },
    {
      id: 'list',
      description: '手紙が1通届いている一覧（letterCount=1・未開封 open=false）',
      props: { api: filledApi },
      act: async (ctx) => {
        await ctx.wait(32);
      },
    },
    {
      id: 'opened',
      probe: true,
      description: 'Probe: 手紙をタップすると開封（open=true・手紙/言葉/抜粋セクションが出る）',
      props: { api: filledApi },
      act: async (ctx) => {
        await ctx.wait(32);
        await ctx.click('ul li button');
        await ctx.wait(32);
      },
    },
    {
      id: 'open-close',
      probe: true,
      description: 'Probe: 開いて閉じると一覧に戻る（open=true→false のトグル対称性）',
      props: { api: filledApi },
      act: async (ctx) => {
        await ctx.wait(32);
        await ctx.click('ul li button');
        await ctx.wait(32);
        await ctx.click('header button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'letter-buttons-match-count',
      description: '一覧の手紙ボタン（ul li button）の数が contract.letterCount と一致する',
      check: ({ root, contract }) => {
        const buttons = root.querySelectorAll('ul li button').length;
        return (
          String(buttons) === contract.letterCount ||
          `手紙ボタン数=${buttons} だが contract.letterCount="${contract.letterCount}"`
        );
      },
    },
    {
      id: 'overlay-present-iff-open',
      description: '開封オーバーレイ（閉じるボタンを持つ header）は open=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasOverlay = Boolean(root.querySelector('.absolute.inset-0'));
        const expectOpen = contract.open === 'true';
        return (
          hasOverlay === expectOpen ||
          `overlay present=${hasOverlay} だが contract.open="${contract.open}"`
        );
      },
    },
    {
      id: 'empty-message-when-no-letters',
      description: '手紙が無いときは empty メッセージを出す（letterCount=0・loading=false）',
      onlyFixtures: ['empty'],
      check: ({ root, contract }) => {
        const emptyShown = Boolean(root.textContent?.includes('まだ手紙は届いていません'));
        return (
          (contract.loading === 'false' && contract.letterCount === '0' && emptyShown) ||
          `expected loading=false & letterCount=0 & empty message, got loading=${contract.loading}, letterCount=${contract.letterCount}, emptyShown=${emptyShown}`
        );
      },
    },
    {
      id: 'list-loaded-not-open',
      description: '一覧読込後は手紙が並び未開封（letterCount>0・open=false）',
      onlyFixtures: ['list'],
      check: ({ contract }) =>
        (contract.loading === 'false' &&
          Number(contract.letterCount) > 0 &&
          contract.open === 'false') ||
        `expected loaded list & open=false, got loading=${contract.loading}, letterCount=${contract.letterCount}, open=${contract.open}`,
    },
    {
      id: 'detail-sections-when-open',
      description: '開封中は手紙・言葉・抜粋セクションが描画される（open=true）',
      onlyFixtures: ['opened'],
      check: ({ root, contract }) => {
        const text = root.textContent ?? '';
        const hasSections = text.includes('手紙') && text.includes('言葉') && text.includes('抜粋');
        return (
          (contract.open === 'true' && hasSections) ||
          `expected open=true & 手紙/言葉/抜粋 sections, got open=${contract.open}, hasSections=${hasSections}`
        );
      },
    },
    {
      id: 'open-then-close-returns-to-list',
      description: '開いて閉じると open=false に戻る（トグル対称性）',
      onlyFixtures: ['open-close'],
      check: ({ contract }) =>
        contract.open === 'false' || `expected open=false after open→close, got "${contract.open}"`,
    },
  ],
});
