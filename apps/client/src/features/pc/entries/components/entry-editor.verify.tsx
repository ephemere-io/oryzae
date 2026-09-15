/**
 * EntryEditor の検証スペック（PC 版「書く」エディタ・SpEntryEditor の PC ツイン）。
 *
 * EntryEditor のデータ取得は全て `api`(ApiClient) を引数に取り、`api=null` で early-return する:
 *   - useSaveEntry の save は `if (!api ...) return null`（fetch しない）
 *   - useAutosaveEntry は enabled=`!!api`=false（タイマーも張らない）
 *   - useUserMe / useFermentationForQuestion は api 無しで即 null（fetch ゼロ）
 *   - SnippetToolbar も api を握るだけで描画時 fetch は無い
 * router は withVerifyProviders が no-op mock を供給する。よって `api={null} auth={null}` を渡せば
 * fetch ゼロの純レンダリングになり、props と操作だけで孤立検証できる。
 *
 * 本文は contentEditable（<input> ではない）なので `ctx.type` で打てない。本文の有無 hasBody は
 * `initialContent` prop 経由で注入する（新規エントリは initialContent がそのまま content になる）。
 *
 * **Issue #314 / #356 でツールバーの「保存」ボタンは廃止された。** 保存は常に自動で、人が押す
 * ボタンは本文ドックの「漬け込む」だけ（⌘S は残るがキーボード経路なので act では叩けない）。
 * 執筆統計はステータスバーの文字数から開く（#360）。よってこのスペックが叩く導線は
 * 「設定」「文字数」「漬け込む」「問いチップ」の4つになる。saveModalOpen 契約は ⌘S や
 * タイトル編集から到達しうるので契約には残し、「勝手に開いていないこと」を invariant で見張る。
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

const PICKLE_BTN = 'button[data-palette-action="pickle"]';
const SETTINGS_BTN = 'button[aria-label="設定"]';
/** 問いの面を開くチップ（「+」）。結ばれた問いのチップが前に並ぶので、役割で指す。 */
const QUESTION_CHIP_BTN = '[data-verify-unit="QuestionChip"] button[aria-haspopup="menu"]';

registerUnit<Props>({
  id: 'EntryEditor',
  title: 'EntryEditor',
  description:
    'PC 版「書く」エディタ（ツールバー3グループ・問いチップ・本文・ドック・ステータスバー）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryEditor {...props} />),
  fixtures: [
    {
      id: 'new-empty',
      description: '新規・本文空（漬込ボタンは disabled・モーダルは全閉）',
      props: { api: null, auth: null },
    },
    {
      id: 'new-with-body',
      description: '新規・本文あり（hasBody=true で漬込が活性）',
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
      id: 'question-select-open',
      description: '問い未紐付で漬け込むを押すと問い選択モーダルが開く（questionSelectOpen=true）',
      props: { api: null, auth: null, initialContent: '漬け込む前の本文' },
      act: async (ctx) => {
        await ctx.click(PICKLE_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'question-chip-open',
      description: '問いチップを押すとドロップダウンが開く（専用行は作らない #228）',
      props: { api: null, auth: null, initialContent: '本文' },
      act: async (ctx) => {
        await ctx.click(QUESTION_CHIP_BTN);
        await ctx.wait(16);
      },
    },
    {
      id: 'whitespace-only',
      probe: true,
      description: 'Probe: 空白だけの本文は hasBody=false（漬込は disabled のまま）',
      props: { api: null, auth: null, initialContent: '     ' },
    },
    {
      id: 'pickle-noop-when-empty',
      probe: true,
      description: 'Probe: 本文空で漬け込むを押しても何も開かない（disabled ボタンの空クリック）',
      props: { api: null, auth: null },
      act: async (ctx) => {
        await ctx.click(PICKLE_BTN);
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'no-save-button-in-toolbar',
      description: '「保存する」ボタンが存在しない（Issue #314 原則2: 押すボタンは漬け込むだけ）',
      check: ({ root }) => {
        const save = root.querySelector('button[aria-label="保存する"]');
        return save === null || '保存ボタンが復活している（自動保存との二重表現に戻っている）';
      },
    },
    {
      id: 'pickle-disabled-iff-no-body',
      description: '漬込ボタンは hasBody=false のとき aria-disabled（本文が無いと漬け込めない）',
      check: ({ root, contract }) => {
        const btn = root.querySelector<HTMLButtonElement>(PICKLE_BTN);
        // 押せないことは本当の `disabled` ではなく aria-disabled で伝えている。
        // disabled にすると React がマウス系イベントを抑止し、フォーカスも受けないため、
        // 「なぜ押せないか」の理由に到達する手段が無くなる。
        const actualDisabled = btn?.getAttribute('aria-disabled') === 'true';
        const expectDisabled = contract.hasBody !== 'true';
        return (
          actualDisabled === expectDisabled ||
          `pickle aria-disabled=${btn?.getAttribute('aria-disabled')} だが contract.hasBody="${contract.hasBody}"`
        );
      },
    },
    {
      id: 'status-bar-always-present',
      description: 'ステータスバーが常に描画される（保存が起きている事実を伝える唯一の場所 #360）',
      check: ({ root }) =>
        Boolean(root.querySelector('[data-verify-unit="EditorStatusBar"]')) ||
        'EditorStatusBar が無い（保存されているか分からない画面に戻っている）',
    },
    {
      id: 'question-chip-always-present',
      description: '問いチップが常に中央カラムに居る（専用行は作らない #228）',
      check: ({ root }) =>
        Boolean(root.querySelector('[data-verify-unit="QuestionChip"]')) ||
        'QuestionChip が無い（問いへの導線が消えている）',
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
          contract.saveModalOpen === 'false' &&
          contract.questionSelectOpen === 'false') ||
        `expected empty/closed, got hasBody=${contract.hasBody}, hasEntry=${contract.hasEntry}, settingsOpen=${contract.settingsOpen}, saveModalOpen=${contract.saveModalOpen}, questionSelectOpen=${contract.questionSelectOpen}`,
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
      id: 'settings-panel-above-palette',
      // パレットは動かせるので、設定パネルの上に来ることがある。以前はそのときパネルの
      // 下半分が塞がれ、スクロールも「このエントリーを消す」も届かなかった。
      description: '設定パネルはパレットより手前に出る（重なっても下に潜らない）',
      onlyFixtures: ['settings-open'],
      check: ({ root }) => {
        const panel = root.querySelector<HTMLElement>('[role="dialog"]');
        const palette = root.querySelector<HTMLElement>('[data-verify-unit="EntryActionPalette"]');
        if (!panel) return '設定パネルが無い';
        if (!palette) return 'パレットが無い';
        return (
          Number(panel.style.zIndex) > Number(palette.style.zIndex) ||
          `設定パネル z=${panel.style.zIndex} がパレット z=${palette.style.zIndex} の下にある`
        );
      },
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
      id: 'question-chip-dropdown-opened',
      description: 'チップクリック後は問いの面が開く',
      onlyFixtures: ['question-chip-open'],
      check: ({ root }) =>
        Boolean(root.querySelector('[data-verify-unit="QuestionChip"] [role="menu"]')) ||
        'チップを押しても問いの面が開かない',
    },
    {
      id: 'whitespace-stays-empty',
      description: '空白のみ本文でも hasBody=false（漬込は開かない）',
      onlyFixtures: ['whitespace-only'],
      check: ({ contract }) =>
        contract.hasBody === 'false' ||
        `expected hasBody=false for whitespace, got "${contract.hasBody}"`,
    },
    {
      id: 'empty-pickle-click-opens-nothing',
      description: '本文空で漬け込むを押してもモーダルは開かない（disabled の空クリック）',
      onlyFixtures: ['pickle-noop-when-empty'],
      check: ({ contract }) =>
        (contract.saveModalOpen === 'false' && contract.questionSelectOpen === 'false') ||
        `expected nothing opened, got saveModalOpen=${contract.saveModalOpen}, questionSelectOpen=${contract.questionSelectOpen}`,
    },
  ],
});
