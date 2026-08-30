/**
 * SpEntryEditor の検証スペック（A 移植・SP 版エディタ）。
 * データ取得フックはすべて `api` を引数に取り、`api=null` で early-return する（save は
 * 即 null・activeQuestions は []・autosave は enabled=false）。router 依存も無い。よって
 * `api=null` を渡せば fetch ゼロの純レンダリングになり、props だけで孤立検証できる。
 *
 * 公表する契約は実際に変化する状態のみ: hasBody / dirty / hasEntry / hasQuestion / sheetOpen
 * ＋発酵 CTA の pickling。saving / pickled は到達しない（api=null では fetch せず save も即
 * null・never-resolve でも save が解決せず pickled が立たない）ため、定数になる属性は
 * 契約に載せない。hasQuestion は Issue #450 で分岐条件になったので載せる（問い未選択で
 * 発酵 CTA を押すと、漬けずに問い選択シートが開く）。
 *
 * i18n（sp.editor）依存のため withVerifyProviders（NextIntlClientProvider）で包む。
 * pickling=true は never-resolve fetch を持つ ApiClient を渡し、CTA を押して再現する
 * （question-create-form の neverResolve と同型。autosave は body 無変更＝delta 0 で発火しない）。
 */

import { registerUnit } from '@oryzae/verify';
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

// 解決しない fetch を持つ ApiClient（pickle 中状態を保持する。as 不要で型を満たす）。
const neverResolveApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: () => new Promise<Response>(() => {}),
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
      description: '新規・本文空（保存ステータスは非表示、発酵 CTA も出ない）',
      props: { api: null, persistDraft: false },
    },
    {
      id: 'editing',
      description: '本文を入力すると編集中（dirty=true・hasBody=true）になる',
      props: { api: null, persistDraft: false },
      act: async (ctx) => {
        await ctx.type('textarea', 'いま感じていること');
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
      description: '問いチップを押すと問い選択シートが開く（sheetOpen=true）',
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
        await ctx.type('textarea', '     ');
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
        await ctx.click('.mx-4 button');
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
        await ctx.click('.mx-4 button');
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
        await ctx.click('.mx-4 button');
        await ctx.wait(16);
      },
    },
    {
      id: 'delete-open',
      probe: true,
      description: 'Probe: 既存エントリで ⋯（削除）を押すと削除確認シートが開く（deleteOpen=true）',
      props: {
        api: null,
        initialEntryId: 'entry-1',
        initialContent: 'タイトル\n本文がここに入る',
        persistDraft: false,
      },
      act: async (ctx) => {
        ctx.click('button[aria-label="削除"]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'hasbody-reflects-textarea',
      description: 'contract.hasBody が本文 textarea の trim 結果を反映する',
      check: ({ root, contract }) => {
        const ta = root.querySelector<HTMLTextAreaElement>('textarea');
        const actuallyHasBody = (ta?.value ?? '').trim().length > 0;
        return (
          contract.hasBody === String(actuallyHasBody) ||
          `contract.hasBody="${contract.hasBody}" だが textarea.value="${ta?.value}"（trim 後 hasBody=${actuallyHasBody}）`
        );
      },
    },
    {
      id: 'ferment-cta-iff-hasentry',
      description: '発酵 CTA は hasEntry=true（entryId 確定）のときだけ描画される',
      check: ({ root, contract }) => {
        const hasCta = Boolean(root.querySelector('.mx-4 button'));
        const expectEntry = contract.hasEntry === 'true';
        return (
          hasCta === expectEntry ||
          `発酵 CTA present=${hasCta} だが contract.hasEntry="${contract.hasEntry}"`
        );
      },
    },
    {
      id: 'no-dead-end-without-questions',
      description:
        'Issue #314: 問い作成モードでシートが開いているなら、必ず入力欄がある（行き止まりにしない）',
      check: ({ root, contract }) => {
        if (contract.sheetOpen !== 'true' || contract.composingQuestion !== 'true') return true;
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
      description: '問い選択シート（閉じるボタン）は sheetOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasSheet = Boolean(root.querySelector('button[aria-label="閉じる"]'));
        const expectOpen = contract.sheetOpen === 'true';
        return (
          hasSheet === expectOpen ||
          `sheet present=${hasSheet} だが contract.sheetOpen="${contract.sheetOpen}"`
        );
      },
    },
    {
      id: 'default-collapsed-empty',
      description: '初期状態は本文空・シート閉・発酵 CTA 無し',
      onlyFixtures: ['empty'],
      check: ({ contract }) =>
        (contract.hasBody === 'false' &&
          contract.sheetOpen === 'false' &&
          contract.hasEntry === 'false') ||
        `expected empty/collapsed, got hasBody=${contract.hasBody}, sheetOpen=${contract.sheetOpen}, hasEntry=${contract.hasEntry}`,
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
        const btn = root.querySelector<HTMLButtonElement>('.mx-4 button');
        return (
          (contract.pickling === 'true' && btn?.disabled === true) ||
          `expected pickling=true & disabled, got pickling=${contract.pickling}, disabled=${btn?.disabled}`
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
          contract.sheetOpen === 'true') ||
        `expected hasQuestion=false & pickling=false & sheetOpen=true, got hasQuestion=${contract.hasQuestion}, pickling=${contract.pickling}, sheetOpen=${contract.sheetOpen}`,
    },
    {
      id: 'question-empty-offers-composer',
      description:
        '問いがゼロのとき CTA から開いたシートは、最初から問いの入力欄を出す（Issue #314）',
      onlyFixtures: ['question-empty-compose'],
      check: ({ root, contract }) => {
        const input = root.querySelector('input[aria-label^="問いを書く"]');
        return (
          (contract.sheetOpen === 'true' &&
            contract.composingQuestion === 'true' &&
            Boolean(input)) ||
          `expected sheetOpen=true & composingQuestion=true & 入力欄あり, got sheetOpen=${contract.sheetOpen}, composingQuestion=${contract.composingQuestion}, input=${Boolean(input)}`
        );
      },
    },
    {
      id: 'delete-trigger-iff-hasentry',
      description: '削除トリガー（⋯ aria-label=削除）は hasEntry=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasTrigger = Boolean(root.querySelector('button[aria-label="削除"]'));
        const expectEntry = contract.hasEntry === 'true';
        return (
          hasTrigger === expectEntry ||
          `削除トリガー present=${hasTrigger} だが contract.hasEntry="${contract.hasEntry}"`
        );
      },
    },
    {
      id: 'delete-sheet-iff-open',
      description: '削除確認シート（fixed オーバーレイ）は deleteOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasSheet = Boolean(root.querySelector('.fixed'));
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
        const hasSheet = Boolean(root.querySelector('.fixed'));
        return (
          (contract.deleteOpen === 'true' && hasSheet) ||
          `⋯ 押下後 deleteOpen=true & シート表示のはずだが deleteOpen=${contract.deleteOpen}, sheet=${hasSheet}`
        );
      },
    },
  ],
});
