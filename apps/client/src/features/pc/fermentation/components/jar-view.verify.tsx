/**
 * JarView の検証スペック（発酵瓶ビュー・PC 版）。
 *
 * データ取得はすべて api seam の奥にある: useFermentationForQuestion(api, id) は api=null で
 * early-return（fetch ゼロ・detail=null）、useJarLayoutSave(api) の saveLayout も api=null で no-op。
 * useJarDrag は純フック（描画時は getBoundingClientRect を呼ばない＝ pointer ハンドラ内だけ）。
 * 子の DetailPane は常時マウントされる（閉時は画面外）が useRouter は withVerifyProviders の
 * no-op router が供給する。useUnread() は provider 不在で既定値に落ち、マウント時の
 * markAllSeen() は no-op（Issue #447: PC の瓶は盤面に全部並ぶので開いた＝読んだ）。
 * よって api=null を渡せば fetch ゼロの純レンダリングで孤立検証できる。
 *
 * 公表する契約は api=null で到達し、かつ fixture 間で実際に変化する状態のみ:
 * questionCount（最大3にキャップ）/ zoomed / editOpen / addOpen / addAvailable。
 * detailOpen は出さない（inner 要素は detail があるときだけ描画＝ api=null では開けず定数になる）。
 *
 * authLoading=true は null を返すため fixture にしない（null fixture 禁止）。
 * 両モーダルは role="dialog" を共有するため、見出しテキスト（問いを編集 / 新しい問いを追加）で識別する。
 */

import { registerUnit } from '@oryzae/verify';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { JarView } from './jar-view';

interface QuestionData {
  id: string;
  currentText: string | null;
  jarX: number | null;
  jarY: number | null;
}

interface Props {
  api: ApiClient | null;
  authLoading: boolean;
  questions: QuestionData[];
  onAddQuestion?: (text: string) => Promise<void>;
  onEditQuestion?: (id: string, text: string) => Promise<void>;
  onArchiveQuestion?: (id: string) => Promise<void>;
}

const noopAsync = async () => {};

const oneQuestion: QuestionData[] = [
  { id: 'q-1', currentText: '私はなぜ書くのか', jarX: null, jarY: null },
];
const twoQuestions: QuestionData[] = [
  { id: 'q-1', currentText: '私はなぜ書くのか', jarX: null, jarY: null },
  { id: 'q-2', currentText: '何を手放したいか', jarX: 40, jarY: 30 },
];
const threeQuestions: QuestionData[] = [
  { id: 'q-1', currentText: '私はなぜ書くのか', jarX: null, jarY: null },
  { id: 'q-2', currentText: '何を手放したいか', jarX: 40, jarY: 30 },
  { id: 'q-3', currentText: '今いちばん怖いもの', jarX: 60, jarY: 60 },
];
const fourQuestions: QuestionData[] = [
  ...threeQuestions,
  { id: 'q-4', currentText: '溢れた4件目', jarX: null, jarY: null },
];

registerUnit<Props>({
  id: 'JarView',
  title: 'JarView',
  description: '発酵瓶ビュー（問いサークル・問い追加/編集モーダル・ズーム・詳細ペイン）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<JarView {...props} />),
  fixtures: [
    {
      id: 'two-questions',
      description: '問い2件を瓶の周りに表示（ズーム/モーダルなし・追加可）',
      props: { api: null, authLoading: false, questions: twoQuestions, onAddQuestion: noopAsync },
    },
    {
      id: 'empty',
      description: '問いゼロ（サークル無し・追加ボタンのみ表示）',
      props: { api: null, authLoading: false, questions: [], onAddQuestion: noopAsync },
    },
    {
      id: 'zoomed',
      description: '問いサークルをクリックするとズームする（zoomed=true）',
      props: { api: null, authLoading: false, questions: oneQuestion, onAddQuestion: noopAsync },
      act: async (ctx) => {
        await ctx.click('[data-verify-unit="QuestionCircle"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'edit-open',
      description: '問いチップを押すと編集モーダルが開く（editOpen=true）',
      props: {
        api: null,
        authLoading: false,
        questions: oneQuestion,
        onEditQuestion: noopAsync,
        onArchiveQuestion: noopAsync,
      },
      act: async (ctx) => {
        // 順序ではなく役割で指す。素の 'button' だとズームコントロールを押してしまう。
        await ctx.click('[data-verify-part="question-chip"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'add-open',
      description: '追加ボタンを押すと追加モーダルが開く（addOpen=true）',
      props: { api: null, authLoading: false, questions: oneQuestion, onAddQuestion: noopAsync },
      act: async (ctx) => {
        await ctx.click('button.border-dashed');
        await ctx.wait(16);
      },
    },
    {
      id: 'full-three',
      probe: true,
      description: 'Probe: 問い3件で上限に達し、追加ボタンが出ない（addAvailable=false）',
      props: { api: null, authLoading: false, questions: threeQuestions, onAddQuestion: noopAsync },
    },
    {
      id: 'overflow-four',
      probe: true,
      description: 'Probe: 問い4件でもサークルは3件にキャップされる（questionCount=3）',
      props: { api: null, authLoading: false, questions: fourQuestions, onAddQuestion: noopAsync },
    },
  ],
  invariants: [
    {
      id: 'circle-count-matches-contract',
      description: '描画される QuestionCircle 数が contract.questionCount と一致する',
      check: ({ root, contract }) => {
        const circles = root.querySelectorAll('[data-verify-unit="QuestionCircle"]').length;
        return (
          String(circles) === contract.questionCount ||
          `QuestionCircle 描画数=${circles} だが contract.questionCount="${contract.questionCount}"`
        );
      },
    },
    {
      id: 'circle-count-capped-at-three',
      description: 'サークル数は問い件数に関わらず最大3にキャップされる',
      check: ({ root }) => {
        const circles = root.querySelectorAll('[data-verify-unit="QuestionCircle"]').length;
        return circles <= 3 || `QuestionCircle 描画数=${circles}（最大3を超過）`;
      },
    },
    {
      id: 'edit-modal-iff-editopen',
      description: '編集モーダル（「問いを編集」見出し）は editOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasEdit = Boolean(root.textContent?.includes('問いを編集'));
        const expectOpen = contract.editOpen === 'true';
        return (
          hasEdit === expectOpen ||
          `編集モーダル present=${hasEdit} だが contract.editOpen="${contract.editOpen}"`
        );
      },
    },
    {
      id: 'add-modal-iff-addopen',
      description: '追加モーダル（「新しい問いを追加」見出し）は addOpen=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasAdd = Boolean(root.textContent?.includes('新しい問いを追加'));
        const expectOpen = contract.addOpen === 'true';
        return (
          hasAdd === expectOpen ||
          `追加モーダル present=${hasAdd} だが contract.addOpen="${contract.addOpen}"`
        );
      },
    },
    {
      id: 'add-button-iff-addavailable',
      description: '追加ボタン（dashed）は addAvailable=true のときだけ描画される',
      check: ({ root, contract }) => {
        const hasAddBtn = Boolean(root.querySelector('button.border-dashed'));
        const expectAvailable = contract.addAvailable === 'true';
        return (
          hasAddBtn === expectAvailable ||
          `追加ボタン present=${hasAddBtn} だが contract.addAvailable="${contract.addAvailable}"`
        );
      },
    },
    {
      id: 'default-two-questions',
      description: '初期状態（問い2件）はズーム/モーダル無し・追加可',
      onlyFixtures: ['two-questions'],
      check: ({ contract }) =>
        (contract.questionCount === '2' &&
          contract.zoomed === 'false' &&
          contract.editOpen === 'false' &&
          contract.addOpen === 'false' &&
          contract.addAvailable === 'true') ||
        `expected 2 questions / no modal / addable, got questionCount=${contract.questionCount}, zoomed=${contract.zoomed}, editOpen=${contract.editOpen}, addOpen=${contract.addOpen}, addAvailable=${contract.addAvailable}`,
    },
    {
      id: 'zoom-after-circle-click',
      description: 'サークルクリック後は zoomed=true',
      onlyFixtures: ['zoomed'],
      check: ({ contract }) =>
        contract.zoomed === 'true' ||
        `expected zoomed=true after circle click, got "${contract.zoomed}"`,
    },
    {
      id: 'edit-open-after-chip-click',
      description: 'チップクリック後は editOpen=true',
      onlyFixtures: ['edit-open'],
      check: ({ contract }) =>
        contract.editOpen === 'true' ||
        `expected editOpen=true after chip click, got "${contract.editOpen}"`,
    },
    {
      id: 'add-open-after-add-click',
      description: '追加ボタンクリック後は addOpen=true',
      onlyFixtures: ['add-open'],
      check: ({ contract }) =>
        contract.addOpen === 'true' ||
        `expected addOpen=true after add click, got "${contract.addOpen}"`,
    },
    {
      id: 'full-three-not-addable',
      description: '問い3件では上限に達し追加不可（addAvailable=false・追加ボタン無し）',
      onlyFixtures: ['full-three'],
      check: ({ root, contract }) => {
        const hasAddBtn = Boolean(root.querySelector('button.border-dashed'));
        return (
          (contract.addAvailable === 'false' && contract.questionCount === '3' && !hasAddBtn) ||
          `expected addAvailable=false & 3 circles & no add button, got addAvailable=${contract.addAvailable}, questionCount=${contract.questionCount}, hasAddBtn=${hasAddBtn}`
        );
      },
    },
    {
      id: 'overflow-capped-to-three',
      description: '問い4件でもサークルは3件にキャップ（questionCount=3）',
      onlyFixtures: ['overflow-four'],
      check: ({ root, contract }) => {
        const circles = root.querySelectorAll('[data-verify-unit="QuestionCircle"]').length;
        return (
          (contract.questionCount === '3' && circles === 3) ||
          `expected questionCount=3 & 3 circles for 4 questions, got questionCount=${contract.questionCount}, circles=${circles}`
        );
      },
    },
  ],
});
