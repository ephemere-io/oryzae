/**
 * SpEntryEditor の検証スペック（A 移植・SP 版エディタ）。
 * データ取得フックはすべて `api` を引数に取り、`api=null` で early-return する（save は
 * 即 null・activeQuestions は []・autosave は enabled=false）。router 依存も無い。よって
 * `api=null` を渡せば fetch ゼロの純レンダリングになり、props だけで孤立検証できる。
 *
 * 公表する契約は実際に変化する状態のみ: hasBody / dirty / hasEntry / hasQuestion / pickerOpen
 * ＋発酵 CTA の pickling。saving / pickled は到達しない（api=null では fetch せず save も即
 * null・never-resolve でも save が解決せず pickled が立たない）ため、定数になる属性は
 * 契約に載せない。hasQuestion は Issue #450 で分岐条件になったので載せる（問い未選択で
 * 発酵 CTA を押すと、漬けずに問い選択シートが開く）。
 *
 * i18n（sp.editor）依存のため withVerifyProviders（NextIntlClientProvider）で包む。
 * pickling=true は never-resolve fetch を持つ ApiClient を渡し、CTA を押して再現する
 * （question-create-form の neverResolve と同型。autosave は body 無変更＝delta 0 で発火しない）。
 */

import { type ActContext, registerUnit } from '@oryzae/verify';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpEntryEditor } from './sp-entry-editor';

interface Props {
  api: ApiClient | null;
  initialQuestionId?: string | null;
  initialEntryId?: string;
  initialContent?: string;
  persistDraft?: boolean;
}

/** 本文（contentEditable）に書く。`ctx.type` は input の value を前提にするので、ここで文字を入れて input を起こす。 */
function typeBody(ctx: ActContext, text: string): void {
  const body = ctx.root.querySelector('[data-sp-body]');
  if (!body) throw new Error('本文（data-sp-body）が無い');
  body.textContent = text;
  body.dispatchEvent(new Event('input', { bubbles: true }));
}

// 解決しない fetch を持つ ApiClient（pickle 中状態を保持する。as 不要で型を満たす）。
const neverResolveApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: () => new Promise<Response>(() => {}),
};

/** JSON を返すだけの最小 Response（as 不要で Response を満たす）。 */
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

// 立てている問いが 2 件ある状態。api=null だと activeQuestions が常に空になり、
// シートの一覧モード（＋その下の「新しく問いを書く」）を検証できないため用意する。
const withQuestionsApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: (path: string) =>
    Promise.resolve(
      path.startsWith('/api/v1/questions')
        ? jsonResponse([
            { id: 'q1', currentText: 'なぜ書き続けるのか' },
            { id: 'q2', currentText: '手放せないものは何か' },
          ])
        : jsonResponse([]),
    ),
};

registerUnit<Props>({
  id: 'SpEntryEditor',
  title: 'SpEntryEditor',
  description: 'SP 版「書く」エディタ（タイトル＋本文・保存ステータス・問い結び・発酵 CTA）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SpEntryEditor {...props} />),
  fixtures: [
    {
      id: 'empty',
      description: '新規・本文空（保存ステータスは非表示、発酵 CTA は並ぶが押せない）',
      props: { api: null, persistDraft: false },
    },
    {
      id: 'editing',
      description: '本文を入力すると編集中（dirty=true・hasBody=true）になる',
      props: { api: null, persistDraft: false },
      act: async (ctx) => {
        typeBody(ctx, 'いま感じていること');
        await ctx.wait(16);
      },
    },
    {
      id: 'saved-existing',
      description: '既存エントリを開いた直後は保存済み（dirty=false・発酵 CTA 表示）',
      props: {
        api: null,
        initialEntryId: 'entry-1',
        initialContent: 'タイトル\n本文がここに入る',
        persistDraft: false,
      },
    },
    {
      id: 'sheet-open',
      description: '「+ 問いを結ぶ」を押すとその場に選び手が開く（pickerOpen=true）',
      props: { api: null, persistDraft: false },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
    {
      id: 'whitespace-only',
      probe: true,
      description: 'Probe: 空白だけの本文は hasBody=false 扱い（保存ステータスを出さない）',
      props: { api: null, persistDraft: false },
      act: async (ctx) => {
        typeBody(ctx, '     ');
        await ctx.wait(16);
      },
    },
    {
      id: 'pickling',
      probe: true,
      description: 'Probe: 発酵 CTA 送信中は pickling=true でボタンが disabled（多重送信不可）',
      props: {
        api: neverResolveApi,
        initialEntryId: 'entry-1',
        // Issue #450: 問いが結ばれていない状態で CTA を押すと問い選択が開くようになった
        // （問い無しのエントリは発酵ループに入らないため）。pickling を再現するには
        // 問いが結ばれている必要があるので、URL 経由の初期紐づけを渡す。
        initialQuestionId: 'question-1',
        initialContent: 'タイトル\n本文がここに入る',
        persistDraft: false,
      },
      act: async (ctx) => {
        await ctx.click('button[data-palette-action="ferment"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'pickle-without-question',
      probe: true,
      description:
        'Probe: 問い未選択で発酵 CTA を押すと、漬けずに問い選択シートが開く（Issue #450）',
      props: {
        api: neverResolveApi,
        initialEntryId: 'entry-1',
        initialContent: 'タイトル\n本文がここに入る',
        persistDraft: false,
      },
      act: async (ctx) => {
        await ctx.click('button[data-palette-action="ferment"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'question-empty-compose',
      probe: true,
      description:
        'Probe: 立てている問いがゼロでも、CTA から開いたシートでその場で問いを書ける（Issue #314）',
      props: {
        api: null,
        initialEntryId: 'entry-1',
        initialContent: 'タイトル\n本文がここに入る',
        persistDraft: false,
      },
      act: async (ctx) => {
        await ctx.click('button[data-palette-action="ferment"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'question-list-with-composer',
      probe: true,
      description: 'Probe: 問いがあるときは一覧を出し、その下から新規作成にも入れる（Issue #314）',
      props: {
        api: withQuestionsApi,
        initialEntryId: 'entry-1',
        initialContent: 'タイトル\n本文がここに入る',
        persistDraft: false,
      },
      act: async (ctx) => {
        await ctx.click('button[data-palette-action="ferment"]');
        await ctx.wait(48);
      },
    },
    {
      id: 'delete-open',
      probe: true,
      description:
        'Probe: 既存エントリで右上の設定 → 末尾の「このエントリーを削除」で削除確認シートが開く（deleteOpen=true）',
      props: {
        api: null,
        initialEntryId: 'entry-1',
        initialContent: 'タイトル\n本文がここに入る',
        persistDraft: false,
      },
      act: async (ctx) => {
        await ctx.click('button[aria-label="表示の設定"]');
        await ctx.wait(32);
        await ctx.click('[data-row-action="delete-entry"]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'hasbody-reflects-body',
      description: 'contract.hasBody が本文（contentEditable）の trim 結果を反映する',
      check: ({ root, contract }) => {
        const text = root.querySelector('[data-sp-body]')?.textContent ?? '';
        const actuallyHasBody = text.trim().length > 0;
        return (
          contract.hasBody === String(actuallyHasBody) ||
          `contract.hasBody="${contract.hasBody}" だが本文="${text}"（trim 後 hasBody=${actuallyHasBody}）`
        );
      },
    },
    {
      id: 'ferment-cta-always',
      description:
        '発酵 CTA は最初から並ぶ（実機レビュー）。本文も保存も無いうちは押せない（押すと理由が出る）',
      check: ({ root, contract }) => {
        const cta = root.querySelector('button[data-palette-action="ferment"]');
        if (!cta) return '発酵 CTA が無い';
        if (contract.hasBody === 'false' && contract.hasEntry === 'false') {
          return cta.getAttribute('aria-disabled') === 'true' || '本文が無いのに押せる';
        }
        return true;
      },
    },
    {
      id: 'no-dead-end-without-questions',
      description:
        'Issue #314: 問い作成モードでシートが開いているなら、必ず入力欄がある（行き止まりにしない）',
      check: ({ root, contract }) => {
        if (contract.pickerOpen !== 'true' || contract.composingQuestion !== 'true') return true;
        // タイトル入力と取り違えないよう、問い入力の aria-label で特定する。
        const input = root.querySelector('input[aria-label^="問いを書く"]');
        return (
          Boolean(input) ||
          'シートを問い作成モードで開いたのに、その場で問いを書く入力欄が無い（＝行き止まり）'
        );
      },
    },
    {
      id: 'sheet-present-iff-open',
      description: '選び手は pickerOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasSheet = Boolean(root.querySelector('[data-verify-unit="QuestionPicker"]'));
        const expectOpen = contract.pickerOpen === 'true';
        return (
          hasSheet === expectOpen ||
          `sheet present=${hasSheet} だが contract.pickerOpen="${contract.pickerOpen}"`
        );
      },
    },
    {
      id: 'default-collapsed-empty',
      description: '初期状態は本文空・シート閉・保存前',
      onlyFixtures: ['empty'],
      check: ({ contract }) =>
        (contract.hasBody === 'false' &&
          contract.pickerOpen === 'false' &&
          contract.hasEntry === 'false') ||
        `expected empty/collapsed, got hasBody=${contract.hasBody}, pickerOpen=${contract.pickerOpen}, hasEntry=${contract.hasEntry}`,
    },
    {
      id: 'editing-after-typing',
      description: '本文入力後は編集中（hasBody=true・dirty=true）',
      onlyFixtures: ['editing'],
      check: ({ contract }) =>
        (contract.hasBody === 'true' && contract.dirty === 'true') ||
        `expected hasBody=true & dirty=true, got hasBody=${contract.hasBody}, dirty=${contract.dirty}`,
    },
    {
      id: 'saved-existing-not-dirty',
      description: '既存エントリを開いた直後は dirty=false（未編集で保存済み表示）',
      onlyFixtures: ['saved-existing'],
      check: ({ root, contract }) => {
        const savedShown = Boolean(root.textContent?.includes('保存しました'));
        return (
          (contract.dirty === 'false' && contract.hasEntry === 'true' && savedShown) ||
          `expected dirty=false & hasEntry=true & "保存しました", got dirty=${contract.dirty}, hasEntry=${contract.hasEntry}, savedShown=${savedShown}`
        );
      },
    },
    {
      id: 'whitespace-stays-empty',
      description: '空白のみ本文でも hasBody=false（保存ステータスを出さない）',
      onlyFixtures: ['whitespace-only'],
      check: ({ contract }) =>
        contract.hasBody === 'false' ||
        `expected hasBody=false after whitespace, got "${contract.hasBody}"`,
    },
    {
      id: 'pickle-button-locked-while-pickling',
      description: '発酵 CTA 送信中は pickling=true でボタンが disabled',
      onlyFixtures: ['pickling'],
      check: ({ root, contract }) => {
        const btn = root.querySelector('button[data-palette-action="ferment"]');
        const locked = btn?.getAttribute('aria-disabled') === 'true';
        return (
          (contract.pickling === 'true' && locked) ||
          `expected pickling=true & locked, got pickling=${contract.pickling}, locked=${locked}`
        );
      },
    },
    {
      id: 'pickle-without-question-opens-sheet',
      description: '問い未選択で発酵 CTA を押しても漬けず、問い選択シートが開く（Issue #450）',
      onlyFixtures: ['pickle-without-question'],
      check: ({ contract }) =>
        (contract.hasQuestion === 'false' &&
          contract.pickling === 'false' &&
          contract.pickerOpen === 'true') ||
        `expected hasQuestion=false & pickling=false & pickerOpen=true, got hasQuestion=${contract.hasQuestion}, pickling=${contract.pickling}, pickerOpen=${contract.pickerOpen}`,
    },
    {
      id: 'question-empty-offers-composer',
      description:
        '問いがゼロのとき CTA から開いたシートは、最初から問いの入力欄を出す（Issue #314）',
      onlyFixtures: ['question-empty-compose'],
      check: ({ root, contract }) => {
        const input = root.querySelector('input[aria-label^="問いを書く"]');
        return (
          (contract.pickerOpen === 'true' &&
            contract.composingQuestion === 'true' &&
            Boolean(input)) ||
          `expected pickerOpen=true & composingQuestion=true & 入力欄あり, got pickerOpen=${contract.pickerOpen}, composingQuestion=${contract.composingQuestion}, input=${Boolean(input)}`
        );
      },
    },
    {
      id: 'question-list-keeps-composer-entry',
      description: '問いがあるときは一覧を出しつつ、新規作成への導線も残す（Issue #314）',
      onlyFixtures: ['question-list-with-composer'],
      check: ({ root, contract }) => {
        const options = root.querySelectorAll('ul li button');
        const composerEntry = Array.from(root.querySelectorAll('button')).some((b) =>
          b.textContent?.includes('新しく問いを書く'),
        );
        return (
          (contract.composingQuestion === 'false' && options.length === 2 && composerEntry) ||
          `expected 一覧2件＋作成導線, got composingQuestion=${contract.composingQuestion}, options=${options.length}, composerEntry=${composerEntry}`
        );
      },
    },
    {
      id: 'delete-not-in-palette',
      description:
        '削除はパレットに並ばない（書いている最中に何度も押す列に、取り返しのつかない操作を置かない）',
      check: ({ root }) =>
        !root.querySelector('[data-palette-action="delete"]') || 'パレットに削除がある',
    },
    {
      id: 'delete-row-iff-settings-open-and-hasentry',
      description:
        '削除の行は、設定シートが開いていて hasEntry=true のときだけ描画される（引っ込む動きの途中は数えない）',
      check: ({ root, contract }) => {
        const hasRow = Boolean(
          root.querySelector(
            '[data-sheet-phase]:not([data-sheet-phase="closing"]) [data-row-action="delete-entry"]',
          ),
        );
        const expectRow = contract.settingsOpen === 'true' && contract.hasEntry === 'true';
        return (
          hasRow === expectRow ||
          `削除の行 present=${hasRow} だが settingsOpen=${contract.settingsOpen} hasEntry=${contract.hasEntry}`
        );
      },
    },
    {
      id: 'delete-sheet-iff-open',
      description: '削除確認シート（fixed オーバーレイ）は deleteOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        // パレットも fixed なので、確認シートは契約で見分ける。
        const sheet = root.querySelector('[data-verify-unit="SpConfirmSheet"]');
        const hasSheet = sheet?.getAttribute('data-verify-open') === 'true';
        const expectOpen = contract.deleteOpen === 'true';
        return (
          hasSheet === expectOpen ||
          `delete sheet present=${hasSheet} だが contract.deleteOpen="${contract.deleteOpen}"`
        );
      },
    },
    {
      id: 'delete-open-after-trigger',
      description: '既存エントリで ⋯ を押すと deleteOpen=true になり確認シートが現れる',
      onlyFixtures: ['delete-open'],
      check: ({ root, contract }) => {
        const sheet = root.querySelector('[data-verify-unit="SpConfirmSheet"]');
        const hasSheet = sheet?.getAttribute('data-verify-open') === 'true';
        return (
          (contract.deleteOpen === 'true' && hasSheet) ||
          `削除を押した後 deleteOpen=true & シート表示のはずだが deleteOpen=${contract.deleteOpen}, sheet=${hasSheet}`
        );
      },
    },
  ],
});
