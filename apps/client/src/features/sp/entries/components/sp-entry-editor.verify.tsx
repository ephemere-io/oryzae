/**
 * SpEntryEditor の検証スペック（A 移植・SP 版エディタ）。
 * データ取得フックはすべて `api` を引数に取り、`api=null` で early-return する（save は
 * 即 null・activeQuestions は []・autosave は enabled=false）。router 依存も無い。よって
 * `api=null` を渡せば fetch ゼロの純レンダリングになり、props だけで孤立検証できる。
 *
 * 公表する契約は実際に変化する状態のみ: hasBody / dirty / hasEntry / sheetOpen ＋発酵 CTA の
 * pickling。saving / pickled / questionLinked は到達しない（api=null では fetch せず save も即
 * null・activeQuestions が空のまま selectedQuestion が出ない／never-resolve でも save が解決せず
 * pickled が立たない）ため、定数になる属性は契約に載せない。
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
      props: { api: null },
    },
    {
      id: 'editing',
      description: '本文を入力すると編集中（dirty=true・hasBody=true）になる',
      props: { api: null },
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
      },
    },
    {
      id: 'sheet-open',
      description: '問いチップを押すと問い選択シートが開く（sheetOpen=true）',
      props: { api: null },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
    {
      id: 'whitespace-only',
      probe: true,
      description: 'Probe: 空白だけの本文は hasBody=false 扱い（保存ステータスを出さない）',
      props: { api: null },
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
        initialContent: 'タイトル\n本文がここに入る',
      },
      act: async (ctx) => {
        await ctx.click('.mx-4 button');
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
  ],
});
