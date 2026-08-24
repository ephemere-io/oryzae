/**
 * EntryEditor の検証スペック（PC 版「書く」エディタ・SpEntryEditor の PC ツイン）。
 *
 * EntryEditor のデータ取得は全て `api`(ApiClient) を引数に取り、`api=null` で early-return する:
 *   - useSaveEntry の save は `if (!api ...) return null`（fetch しない）
 *   - useAutosaveEntry は enabled=`!!api`=false（タイマーも張らない）
 *   - useUserMe / useFermentationForQuestion は api 無しで即 null（fetch ゼロ）
 *   - SnippetToolbar も api を握るだけで描画時 fetch は無い
 * router は withVerifyProviders が no-op mock を供給する。よって `api={null} auth={null}` を渡せば
 * fetch ゼロの純レンダリングになり、props と toolbar クリックだけで孤立検証できる。
 *
 * 本文は contentEditable（<input> ではない）なので `ctx.type` で打てない。本文の有無 hasBody は
 * `initialContent` prop 経由で注入する（新規エントリは initialContent がそのまま content になる）。
 *
 * 公表する契約は実際に変化する状態のみ:
 *   hasEntry（新規/既存）・hasBody（保存/漬込ボタンの活性条件）・settingsOpen / statsOpen /
 *   saveModalOpen / questionSelectOpen（toolbar クリックで開く子モーダル/ドロワー）。
 * dirty / writingMode / voiceActive / saving は孤立検証では到達しない・定数になるため契約に載せない
 * （dirty は content==savedContent で常に false、writingMode は ja で常に vertical、voice/save は
 * api=null と SpeechRecognition 不在で発火しない）。SpEntryEditor の「定数になる属性は契約に載せない」
 * 方針に倣う。
 *
 * i18n（editor.*）依存のため withVerifyProviders（NextIntlClientProvider, locale=ja）で包む。
 */

import { registerUnit } from '@oryzae/verify';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { EntryEditor } from './entry-editor';

interface AuthState {
  accessToken: string;
}

interface Props {
  entryId?: string;
  initialContent?: string;
  initialTitle?: string;
  api: ApiClient | null;
  auth: AuthState | null;
}

// toolbar の各アイコンボタンは aria-label（= data-tooltip と同じ i18n 文言）で引く。
const SAVE_BTN = 'button[aria-label="保存する"]';
const PICKLE_BTN = 'button[aria-label="漬け込む"]';
const SETTINGS_BTN = 'button[aria-label="設定"]';
const STATS_BTN = 'button[aria-label="執筆統計"]';

registerUnit<Props>({
  id: 'EntryEditor',
  title: 'EntryEditor',
  description: 'PC 版「書く」エディタ（toolbar・問い結び・本文・各種モーダル/ドロワーの開閉）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryEditor {...props} />),
  fixtures: [
    {
      id: 'new-empty',
      description: '新規・本文空（保存/漬込ボタンは disabled・モーダルは全閉）',
      props: { api: null, auth: null },
    },
    {
      id: 'new-with-body',
      description: '新規・本文あり（hasBody=true で保存/漬込が活性）',
      props: { api: null, auth: null, initialContent: '今日感じたことを書く' },
    },
    {
      id: 'existing-entry',
      description: '既存エントリを開いた状態（hasEntry=true・本文先頭行はタイトル扱い）',
      props: {
        api: null,
        auth: null,
        entryId: 'entry-1',
        initialContent: 'タイトル\n本文がここに入る',
      },
    },
    {
      id: 'settings-open',
      description: '設定ボタンを押すと設定ドロワーが開く（settingsOpen=true）',
      props: { api: null, auth: null, initialContent: '本文' },
      act: async (ctx) => {
        await ctx.click(SETTINGS_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'stats-open',
      description: '執筆統計ボタンを押すと統計ポップアップが開く（statsOpen=true）',
      props: { api: null, auth: null, initialContent: '本文' },
      act: async (ctx) => {
        await ctx.click(STATS_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'save-modal-open',
      description:
        '新規・タイトル未設定で保存を押すとタイトル入力モーダルが開く（saveModalOpen=true）',
      props: { api: null, auth: null, initialContent: 'タイトル未設定の本文' },
      act: async (ctx) => {
        await ctx.click(SAVE_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'question-select-open',
      description: '問い未紐付で漬け込むを押すと問い選択モーダルが開く（questionSelectOpen=true）',
      props: { api: null, auth: null, initialContent: '漬け込む前の本文' },
      act: async (ctx) => {
        await ctx.click(PICKLE_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'whitespace-only',
      probe: true,
      description: 'Probe: 空白だけの本文は hasBody=false（保存/漬込は disabled のまま）',
      props: { api: null, auth: null, initialContent: '     ' },
    },
    {
      id: 'save-noop-when-empty',
      probe: true,
      description: 'Probe: 本文空で保存を押しても何も開かない（disabled ボタンの空クリック）',
      props: { api: null, auth: null },
      act: async (ctx) => {
        await ctx.click(SAVE_BTN);
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'save-disabled-iff-no-body',
      description: '保存ボタンは hasBody=false のとき disabled（本文が無いと保存できない）',
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>(SAVE_BTN);
        const expectDisabled = contract.hasBody !== 'true';
        return (
          btn?.disabled === expectDisabled ||
          `save disabled=${btn?.disabled} だが contract.hasBody="${contract.hasBody}"`
        );
      },
    },
    {
      id: 'pickle-disabled-iff-no-body',
      description: '漬込ボタンは hasBody=false のとき disabled（本文が無いと漬け込めない）',
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>(PICKLE_BTN);
        const expectDisabled = contract.hasBody !== 'true';
        return (
          btn?.disabled === expectDisabled ||
          `pickle disabled=${btn?.disabled} だが contract.hasBody="${contract.hasBody}"`
        );
      },
    },
    {
      id: 'settings-drawer-present-iff-open',
      description: '設定ドロワーは settingsOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const present = Boolean(root.querySelector('[data-verify-unit="SettingsDrawer"]'));
        const expectOpen = contract.settingsOpen === 'true';
        return (
          present === expectOpen ||
          `SettingsDrawer present=${present} だが contract.settingsOpen="${contract.settingsOpen}"`
        );
      },
    },
    {
      id: 'stats-popup-present-iff-open',
      description: '統計ポップアップは statsOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const present = Boolean(root.querySelector('[data-verify-unit="StatsPopup"]'));
        const expectOpen = contract.statsOpen === 'true';
        return (
          present === expectOpen ||
          `StatsPopup present=${present} だが contract.statsOpen="${contract.statsOpen}"`
        );
      },
    },
    {
      id: 'save-modal-present-iff-open',
      description: 'タイトル入力モーダルは saveModalOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const present = Boolean(root.querySelector('[data-verify-unit="SaveTitleModal"]'));
        const expectOpen = contract.saveModalOpen === 'true';
        return (
          present === expectOpen ||
          `SaveTitleModal present=${present} だが contract.saveModalOpen="${contract.saveModalOpen}"`
        );
      },
    },
    {
      id: 'question-select-present-iff-open',
      description: '問い選択モーダルは questionSelectOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const present = Boolean(root.querySelector('[data-verify-unit="QuestionSelectModal"]'));
        const expectOpen = contract.questionSelectOpen === 'true';
        return (
          present === expectOpen ||
          `QuestionSelectModal present=${present} だが contract.questionSelectOpen="${contract.questionSelectOpen}"`
        );
      },
    },
    {
      id: 'new-empty-all-closed',
      description: '初期状態（新規・空）は本文無し・全モーダル閉',
      onlyFixtures: ['new-empty'],
      check: ({ contract }) =>
        (contract.hasBody === 'false' &&
          contract.hasEntry === 'false' &&
          contract.settingsOpen === 'false' &&
          contract.statsOpen === 'false' &&
          contract.saveModalOpen === 'false' &&
          contract.questionSelectOpen === 'false') ||
        `expected empty/closed, got hasBody=${contract.hasBody}, hasEntry=${contract.hasEntry}, settingsOpen=${contract.settingsOpen}, statsOpen=${contract.statsOpen}, saveModalOpen=${contract.saveModalOpen}, questionSelectOpen=${contract.questionSelectOpen}`,
    },
    {
      id: 'existing-has-entry',
      description: '既存エントリ fixture は hasEntry=true',
      onlyFixtures: ['existing-entry'],
      check: ({ contract }) =>
        contract.hasEntry === 'true' || `expected hasEntry=true, got "${contract.hasEntry}"`,
    },
    {
      id: 'settings-opened-after-click',
      description: '設定クリック後は settingsOpen=true',
      onlyFixtures: ['settings-open'],
      check: ({ contract }) =>
        contract.settingsOpen === 'true' ||
        `expected settingsOpen=true after click, got "${contract.settingsOpen}"`,
    },
    {
      id: 'save-modal-opened-after-click',
      description: '新規・無題で保存クリック後は saveModalOpen=true',
      onlyFixtures: ['save-modal-open'],
      check: ({ contract }) =>
        contract.saveModalOpen === 'true' ||
        `expected saveModalOpen=true after click, got "${contract.saveModalOpen}"`,
    },
    {
      id: 'question-select-opened-after-click',
      description: '問い未紐付で漬込クリック後は questionSelectOpen=true',
      onlyFixtures: ['question-select-open'],
      check: ({ contract }) =>
        contract.questionSelectOpen === 'true' ||
        `expected questionSelectOpen=true after click, got "${contract.questionSelectOpen}"`,
    },
    {
      id: 'whitespace-stays-empty',
      description: '空白のみ本文でも hasBody=false（保存/漬込は開かない）',
      onlyFixtures: ['whitespace-only'],
      check: ({ contract }) =>
        contract.hasBody === 'false' ||
        `expected hasBody=false for whitespace, got "${contract.hasBody}"`,
    },
    {
      id: 'empty-save-click-opens-nothing',
      description: '本文空で保存を押してもモーダルは開かない（disabled の空クリック）',
      onlyFixtures: ['save-noop-when-empty'],
      check: ({ contract }) =>
        (contract.saveModalOpen === 'false' && contract.questionSelectOpen === 'false') ||
        `expected nothing opened, got saveModalOpen=${contract.saveModalOpen}, questionSelectOpen=${contract.questionSelectOpen}`,
    },
  ],
});
