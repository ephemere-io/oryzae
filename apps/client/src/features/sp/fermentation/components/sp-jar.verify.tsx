/**
 * SpJar の検証スペック（SP 版「瓶」= 壜のまわりを問いの円が回る画面）。
 *
 * `questions` / `loading` / `onManageQuestions` は props なので、状態機械
 * （読込中 / 問い0件 / 問いあり / 円を開く / 要素を開く）を props と click だけで再現できる。
 * 手紙の有無（円の中心の印）と円の中身は `api` 越しに取るので、fetch を解決する偽
 * ApiClient を注入する。`new Response(body, { status: 200 })` で .ok と .json() が成立する
 * （as / any 不要）。
 *
 * router(useRouter) は withVerifyProviders が no-op を供給するため「返事を書く」も副作用なし。
 * useUnread() は UnreadContext の default（ready=false）なので、未読の印は出ない状態で固定される。
 * i18n（sp.jar）依存のため withVerifyProviders（NextIntlClientProvider）で包む。
 *
 * 公表する契約は実際に変化する状態のみ: questionCount / open / element / unreadCount。
 */

import { registerUnit } from '@oryzae/verify';
import type { JarQuestion } from '@/features/shared/questions/types';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpJar } from './sp-jar';

interface Props {
  api: ApiClient | null;
  questions: JarQuestion[];
  loading: boolean;
  onManageQuestions: () => void;
}

const questions: JarQuestion[] = [
  { id: 'q-1', currentText: '最近うれしかったことは？', jarX: null, jarY: null },
  { id: 'q-2', currentText: 'なぜ続けているのか', jarX: null, jarY: null },
];

const summaryJson = [
  { id: 'f-1', questionId: 'q-1', status: 'completed', createdAt: '2026-06-20T00:00:00.000Z' },
];

// GET /api/v1/fermentations/:id の実レスポンス形。Issue #490 で共有 hook が正規化する
// ようになったため、id / questionId を欠くスタブは null に落ちる（＝中身が出ない）。
const detailJson = {
  id: 'f-1',
  questionId: 'q-1',
  targetPeriod: '2026-06',
  status: 'completed',
  worksheet: null,
  letter: {
    id: 'l-1',
    bodyText: 'あなたの言葉から、静かな喜びが立ち上っています。',
    jarX: null,
    jarY: null,
  },
  keywords: [{ id: 'k-1', keyword: '感謝', description: '小さなことに気づく力。' }],
  snippets: [
    {
      id: 's-1',
      originalText: '朝の光がきれいだった',
      sourceDate: '2026-06-18T00:00:00.000Z',
      selectionReason: '同じ光景が三度出てくる。',
    },
  ],
};

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

/** 手紙が1通届いている偽 ApiClient。as/any 不要で型を満たす。 */
const filledApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: (path) => {
    // 詳細(/fermentations/:id) を先に判定 → 一覧(/fermentations) → questions。
    if (path.includes('/fermentations/')) return jsonResponse(detailJson);
    if (path.includes('/fermentations')) return jsonResponse(summaryJson);
    return jsonResponse([]);
  },
};

/** どのエンドポイントも空。円は出るが中身も手紙も無い。 */
const emptyApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: () => jsonResponse([]),
};

const noop = () => {};

registerUnit<Props>({
  id: 'SpJar',
  title: 'SpJar',
  description:
    'SP 版「瓶」: 中央の壜のまわりを問いの円が回り、タップで開いて言葉・抜粋・手紙を読む。',
  kind: 'component',
  // SP の一画面ぶんの箱に入れて描く。SpJar は縦積みで余りを軌道に渡すので、
  // 高さの無い箱に置くと壜も円も潰れる（実画面は 100dvh のシェルの中にある）。
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '640px' }}>
        <SpJar {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'loading',
      description: '問いがまだ取れていない（枠を出す・「問いがありません」は出さない）',
      props: { api: emptyApi, questions: [], loading: true, onManageQuestions: noop },
    },
    {
      id: 'no-questions',
      description: '問いが0件（立てる前。壜だけでは何もできないので案内を出す）',
      props: { api: emptyApi, questions: [], loading: false, onManageQuestions: noop },
    },
    {
      id: 'orbit',
      description: '問いが2件、軌道の上に並ぶ（questionCount=2・open=false）',
      props: { api: filledApi, questions, loading: false, onManageQuestions: noop },
      act: async (ctx) => {
        await ctx.wait(32);
      },
    },
    {
      id: 'opened',
      probe: true,
      description: 'Probe: 円をタップすると開く（open=true・中の要素が並ぶ）',
      props: { api: filledApi, questions, loading: false, onManageQuestions: noop },
      act: async (ctx) => {
        await ctx.wait(32);
        await ctx.click('button[data-question-id="q-1"]');
        await ctx.wait(48);
      },
    },
    {
      id: 'open-close',
      probe: true,
      description: 'Probe: 開いて閉じると軌道に戻る（open=true→false のトグル対称性）',
      props: { api: filledApi, questions, loading: false, onManageQuestions: noop },
      act: async (ctx) => {
        await ctx.wait(32);
        await ctx.click('button[data-question-id="q-1"]');
        await ctx.wait(48);
        await ctx.click('header button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'circles-match-question-count',
      description: '軌道の円の数が contract.questionCount と一致する',
      check: ({ root, contract }) => {
        const circles = root.querySelectorAll('button[data-question-id]').length;
        return (
          String(circles) === contract.questionCount ||
          `円の数=${circles} だが contract.questionCount="${contract.questionCount}"`
        );
      },
    },
    {
      id: 'manage-button-always-present',
      description: '問いの管理へ入る口は常にある（SP はボトムナビを持たない唯一の入口）',
      onlyFixtures: ['loading', 'no-questions', 'orbit', 'opened'],
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return text.includes('問いを追加・編集') || '「問いを追加・編集」ボタンが無い';
      },
    },
    {
      id: 'loading-shows-frame-not-empty-message',
      description: '取得中は枠だけ出す（0件の案内を出さない）',
      onlyFixtures: ['loading'],
      check: ({ root, contract }) => {
        const skeleton = root.querySelector('[data-skeleton-slot="orbit"]');
        const saysEmpty = (root.textContent ?? '').includes('問いがまだありません');
        return (
          (contract.loading === 'true' && skeleton !== null && !saysEmpty) ||
          `loading=${contract.loading}, 枠=${skeleton !== null}, 0件の案内=${saysEmpty}（取得中に「ありません」を出すと問いを消したように見える）`
        );
      },
    },
    {
      id: 'empty-message-when-no-questions',
      description: '問いが0件なら案内を出す（questionCount=0）',
      onlyFixtures: ['no-questions'],
      check: ({ root, contract }) => {
        const shown = (root.textContent ?? '').includes('問いがまだありません');
        return (
          (contract.questionCount === '0' && shown) ||
          `questionCount=${contract.questionCount}, 案内=${shown}`
        );
      },
    },
    {
      id: 'zoom-present-iff-open',
      description: '開いた円（SpQuestionZoom）は open=true のときだけ描画される',
      check: ({ root, contract }) => {
        const zoom = root.querySelector('[data-verify-unit="SpQuestionZoom"]') !== null;
        return (
          zoom === (contract.open === 'true') ||
          `zoom present=${zoom} だが contract.open="${contract.open}"`
        );
      },
    },
    {
      id: 'opened-shows-elements',
      description: '開いた円には言葉・抜粋・手紙が並ぶ（読むのはタップした後）',
      onlyFixtures: ['opened'],
      check: ({ root, contract }) => {
        const zoom = root.querySelector('[data-verify-unit="SpQuestionZoom"]');
        const keywords = zoom?.getAttribute('data-verify-keyword-count');
        const hasLetter = zoom?.getAttribute('data-verify-has-letter');
        return (
          (contract.open === 'true' && keywords === '1' && hasLetter === 'true') ||
          `open=${contract.open}, keywordCount=${keywords}, hasLetter=${hasLetter}`
        );
      },
    },
    {
      id: 'open-then-close-returns-to-orbit',
      description: '開いて閉じると open=false に戻る（トグル対称性）',
      onlyFixtures: ['open-close'],
      check: ({ contract }) =>
        contract.open === 'false' || `expected open=false after open→close, got "${contract.open}"`,
    },
  ],
});
