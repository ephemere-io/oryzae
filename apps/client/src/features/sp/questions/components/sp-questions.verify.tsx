/**
 * SpQuestions の検証スペック（A 移植）。
 * SP 版「問い」管理（一覧・追加・編集・終了・提案の受け入れ/見送り）。データ取得・更新は
 * page 側で行い、ここは props で受ける presentational 構成なので孤立検証できる。
 * sheet（追加/編集ボトムシート）の開閉と draft の有無を契約として公表し、
 * 「シート open ⟺ textarea が描画される」「保存ボタンの disabled が contract（draftEmpty || submitting）
 * と一致する」を invariant＋act で検証する。i18n（sp.questions）依存のため
 * withVerifyProviders（NextIntlClientProvider）で包む。
 *
 * submitting=true は submit() 内でしか到達できないため、解決しない Promise を createQuestion に
 * 渡して送信中状態を再現する（setSubmitting(false) が走らず submitting が立ち続ける）。
 */

import { registerUnit } from '@oryzae/verify';
import type { QuestionItem } from '@/features/shared/questions/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpQuestions } from './sp-questions';

interface Props {
  questions: QuestionItem[];
  loading: boolean;
  createQuestion: (text: string) => Promise<void> | void;
  editQuestion: (id: string, text: string) => Promise<void> | void;
  archiveQuestion: (id: string) => Promise<void> | void;
  unarchiveQuestion?: (id: string) => Promise<void> | void;
  acceptQuestion: (id: string) => Promise<void> | void;
  rejectQuestion: (id: string) => Promise<void> | void;
}

const noop = () => Promise.resolve();
// 送信中状態を保持するため解決しない Promise（setSubmitting(false) を発火させない）。
const neverResolve = () => new Promise<void>(() => {});

const TIMESTAMPS = { createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' };

const proposedItem: QuestionItem = {
  id: 'q-proposed',
  currentText: '最近、何に時間を使いたいと思っている？',
  isArchived: false,
  isProposedByOryzae: true,
  isValidatedByUser: false,
  ...TIMESTAMPS,
};

const activeItem: QuestionItem = {
  id: 'q-active',
  currentText: 'いま一番大事にしたいことは？',
  isArchived: false,
  isProposedByOryzae: false,
  isValidatedByUser: false,
  ...TIMESTAMPS,
};

const archivedItem: QuestionItem = {
  id: 'q-archived',
  currentText: '去年の春に考えていたことは？',
  isArchived: true,
  isProposedByOryzae: false,
  isValidatedByUser: true,
  ...TIMESTAMPS,
};

const baseProps = (overrides: Partial<Props> = {}): Props => ({
  questions: [proposedItem, activeItem],
  loading: false,
  createQuestion: noop,
  editQuestion: noop,
  archiveQuestion: noop,
  unarchiveQuestion: noop,
  acceptQuestion: noop,
  rejectQuestion: noop,
  ...overrides,
});

registerUnit<Props>({
  id: 'SpQuestions',
  title: 'SpQuestions',
  description: 'SP 版「問い」管理（一覧・追加/編集ボトムシート・提案の受け入れ/見送り）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SpQuestions {...props} />),
  fixtures: [
    {
      id: 'list',
      description: '一覧（提案1件＋自分の問い1件、シートは閉じている）',
      props: baseProps(),
    },
    {
      id: 'loading',
      description: 'ロード中（本文は描画されずヘッダのみ）',
      props: baseProps({ loading: true }),
    },
    {
      id: 'add-sheet',
      description: '「新しい問いを立てる」を押すと追加シートが開く',
      props: baseProps(),
      act: async (ctx) => {
        // dashed の「新しい問いを立てる」ボタン（add の svg <title>add</title> を含む最後のボタン）。
        const buttons = Array.from(ctx.root.querySelectorAll('button'));
        const addBtn = buttons.find((b) => b.querySelector('title')?.textContent === 'add');
        addBtn?.click();
        await ctx.wait(16);
      },
    },
    {
      id: 'edit-sheet',
      description: '自分の問いを押すと編集シートが開き、本文が draft に入る',
      props: baseProps(),
      act: async (ctx) => {
        // 自分の問い（edit の svg <title>edit</title> を含むボタン）をクリック。
        const buttons = Array.from(ctx.root.querySelectorAll('button'));
        const editBtn = buttons.find((b) => b.querySelector('title')?.textContent === 'edit');
        editBtn?.click();
        await ctx.wait(16);
      },
    },
    {
      id: 'archive-confirm',
      description:
        '編集シートで「この問いをアーカイブする」を押すと、同じ場所が確かめに変わる（面を敷かない）',
      props: baseProps(),
      act: async (ctx) => {
        const buttons = Array.from(ctx.root.querySelectorAll('button'));
        buttons.find((b) => b.querySelector('title')?.textContent === 'edit')?.click();
        await ctx.wait(16);
        await ctx.click('[data-archive-question]');
        await ctx.wait(16);
      },
    },
    {
      id: 'archived-list',
      description: 'アーカイブした問いを開くと「戻す」が並ぶ',
      props: baseProps({ questions: [activeItem, archivedItem] }),
      act: async (ctx) => {
        await ctx.click('[data-archived-toggle]');
        await ctx.wait(16);
      },
    },
    {
      id: 'archived-at-limit',
      description: '生きている問いが上限なら「戻す」は押せず、理由を言う',
      props: baseProps({
        questions: [
          ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ ...activeItem, id: `q-${id}` })),
          archivedItem,
        ],
      }),
      act: async (ctx) => {
        await ctx.click('[data-archived-toggle]');
        await ctx.wait(16);
      },
    },
    {
      id: 'submitting',
      description: '保存中（in-flight）は保存ボタンが disabled になり多重送信を防ぐ',
      props: baseProps({ createQuestion: neverResolve }),
      act: async (ctx) => {
        const buttons = Array.from(ctx.root.querySelectorAll('button'));
        const addBtn = buttons.find((b) => b.querySelector('title')?.textContent === 'add');
        addBtn?.click();
        await ctx.wait(16);
        await ctx.type('textarea', '今日の問い');
        await ctx.wait(16);
        await ctx.click('[data-question-save]');
        await ctx.wait(16);
      },
    },
    {
      id: 'whitespace-only',
      probe: true,
      description: 'Probe: 追加シートで空白だけ入力しても保存ボタンは disabled のまま',
      props: baseProps(),
      act: async (ctx) => {
        const buttons = Array.from(ctx.root.querySelectorAll('button'));
        const addBtn = buttons.find((b) => b.querySelector('title')?.textContent === 'add');
        addBtn?.click();
        await ctx.wait(16);
        await ctx.type('textarea', '   ');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'save-sits-beside-cancel',
      description: '保存はシートの見出しでキャンセルの隣に、同じ高さで並ぶ',
      onlyFixtures: ['add-sheet', 'edit-sheet'],
      check: ({ root }) => {
        const save = root.querySelector<HTMLElement>('[data-question-save]');
        const cancel = save?.previousElementSibling;
        if (!save || !(cancel instanceof HTMLElement)) return '保存の隣にキャンセルが無い';
        return (
          Math.abs(save.getBoundingClientRect().height - cancel.getBoundingClientRect().height) <
            1 || '保存とキャンセルの高さが違う'
        );
      },
    },
    {
      id: 'archive-confirm-without-surface',
      description: 'アーカイブの確かめは面（背景色）を敷かない',
      onlyFixtures: ['archive-confirm'],
      check: ({ root }) => {
        const confirm = root.querySelector<HTMLElement>('[data-archive-confirm]');
        if (!confirm) return '確かめが出ていない';
        const bg = getComputedStyle(confirm).backgroundColor;
        return bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent' || `確かめに面がある: ${bg}`;
      },
    },
    {
      id: 'archived-offers-restore',
      description: 'アーカイブした問いを開くと、問いごとに「戻す」がある。上限なら押せない',
      onlyFixtures: ['archived-list', 'archived-at-limit'],
      check: ({ root, contract }) => {
        const restore = root.querySelector<HTMLButtonElement>('[data-unarchive="q-archived"]');
        if (!restore) return '「戻す」が無い';
        const expected = contract.atLimit === 'true';
        return (
          restore.disabled === expected || `戻す disabled=${restore.disabled}, 上限=${expected}`
        );
      },
    },
    {
      id: 'sheet-open-iff-textarea-present',
      description: 'sheetMode が none でないとき、かつそのときだけ textarea が描画される',
      check: ({ root, contract }) => {
        const hasTextarea = Boolean(root.querySelector('textarea'));
        const sheetOpen = contract.sheetMode !== 'none';
        return (
          hasTextarea === sheetOpen ||
          `textarea present=${hasTextarea} だが contract.sheetMode="${contract.sheetMode}"`
        );
      },
    },
    {
      id: 'save-disabled-matches-contract',
      description: '保存ボタンの disabled が contract（draftEmpty || submitting）と一致する',
      onlyFixtures: ['add-sheet', 'edit-sheet', 'submitting', 'whitespace-only'],
      check: ({ root, contract }) => {
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-question-save]');
        const expectedDisabled = contract.draftEmpty === 'true' || contract.submitting === 'true';
        return (
          saveBtn?.disabled === expectedDisabled ||
          `保存ボタン disabled=${saveBtn?.disabled}, expected=${expectedDisabled} (draftEmpty=${contract.draftEmpty}, submitting=${contract.submitting})`
        );
      },
    },
    {
      id: 'loading-hides-body',
      description: 'loading=true のとき問い一覧（add ボタン）は描画されない',
      onlyFixtures: ['loading'],
      check: ({ root, contract }) => {
        const hasAddBtn = Array.from(root.querySelectorAll('button')).some(
          (b) => b.querySelector('title')?.textContent === 'add',
        );
        return (
          (contract.loading === 'true' && !hasAddBtn) ||
          `expected loading=true & 一覧非表示, got loading=${contract.loading}, addBtn=${hasAddBtn}`
        );
      },
    },
    {
      id: 'add-sheet-mode',
      description: '追加シートを開くと sheetMode=add になる',
      onlyFixtures: ['add-sheet'],
      check: ({ contract }) =>
        contract.sheetMode === 'add' ||
        `expected sheetMode=add after click, got "${contract.sheetMode}"`,
    },
    {
      id: 'edit-sheet-mode-prefilled',
      description:
        '編集シートを開くと sheetMode=edit になり draft に本文が入る（draftEmpty=false）',
      onlyFixtures: ['edit-sheet'],
      check: ({ contract }) =>
        (contract.sheetMode === 'edit' && contract.draftEmpty === 'false') ||
        `expected sheetMode=edit & draftEmpty=false, got sheetMode="${contract.sheetMode}", draftEmpty="${contract.draftEmpty}"`,
    },
    {
      id: 'locked-while-submitting',
      description: '送信中は submitting=true で保存ボタンが disabled（多重送信不可）',
      onlyFixtures: ['submitting'],
      check: ({ root, contract }) => {
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-question-save]');
        return (
          (contract.submitting === 'true' && saveBtn?.disabled === true) ||
          `expected submitting=true & disabled, got submitting=${contract.submitting}, disabled=${saveBtn?.disabled}`
        );
      },
    },
    {
      id: 'whitespace-stays-empty',
      description: '空白のみ入力でも draftEmpty=true のままで保存ボタンは disabled',
      onlyFixtures: ['whitespace-only'],
      check: ({ root, contract }) => {
        const saveBtn = root.querySelector<HTMLButtonElement>('[data-question-save]');
        return (
          (contract.draftEmpty === 'true' && saveBtn?.disabled === true) ||
          `expected draftEmpty=true & disabled after whitespace, got draftEmpty=${contract.draftEmpty}, disabled=${saveBtn?.disabled}`
        );
      },
    },
  ],
});
