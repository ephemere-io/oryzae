/**
 * SpFermentationDock の検証スペック。
 *
 * 見るのは: 覗く段は問いと日付の 1 行（「発酵の結果」の見出しは出さない）、結んだ問いが複数なら問いを、
 * 発酵が複数回なら日付を上で選べる、抜粋ごとの日付は出さない、問いが無ければ結ぶ入口、取得中は骨組み。
 */

import { registerUnit } from '@oryzae/verify';
import { useState } from 'react';
import type { DockDetent } from '@/components/ui/dock-sheet';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { type DockQuestion, type DockRound, SpFermentationDock } from './sp-fermentation-dock';

interface Props {
  detent: DockDetent;
  detail: FermentationDetail | null;
  loading: boolean;
  questions: DockQuestion[];
  rounds: DockRound[];
}

const ONE_QUESTION: DockQuestion[] = [
  { id: 'q-1', text: '自分は人生をどのように肯定するのだろう' },
];
const TWO_QUESTIONS: DockQuestion[] = [
  ...ONE_QUESTION,
  { id: 'q-2', text: '死ぬまでに時間を費やしたいこととは？' },
];
const ONE_ROUND: DockRound[] = [{ id: 'ferm-1', createdAt: '2026-09-14T00:00:00.000Z' }];
const THREE_ROUNDS: DockRound[] = [
  ...ONE_ROUND,
  { id: 'ferm-0', createdAt: '2026-08-30T00:00:00.000Z' },
  { id: 'ferm-00', createdAt: '2026-08-16T00:00:00.000Z' },
];

const NO_JAR_POS = { jarX: null, jarY: null };

function makeDetail(overrides: Partial<FermentationDetail>): FermentationDetail {
  return {
    id: 'ferm-1',
    questionId: 'q-1',
    targetPeriod: '2026-05',
    status: 'completed',
    worksheet: null,
    snippets: [],
    keywords: [],
    letter: null,
    scannedEntries: [],
    ...overrides,
  };
}

function keyword(id: string, text: string) {
  return { id, keyword: text, description: `${text} についての気づき。`, ...NO_JAR_POS };
}

function snippet(id: string, text: string) {
  return {
    id,
    snippetType: 'core' as const,
    originalText: text,
    sourceDate: '2026-05-01T00:00:00.000Z',
    selectionReason: 'この一節を選んだ理由。',
    ...NO_JAR_POS,
  };
}

const FULL = makeDetail({
  keywords: [keyword('k1', '静けさ'), keyword('k2', '余白'), keyword('k3', '手触り')],
  snippets: [
    snippet('s1', '朝の光が差し込む台所で、ゆっくりとコーヒーを淹れる時間が好きだ。'),
    snippet('s2', '目を閉じると色んなことを考えてしまう。'),
    snippet('s3', '服を売るのではなく、その視点を売ること。'),
    snippet('s4', '四つ目の抜粋。全画面でだけ出る。'),
  ],
  letter: {
    id: 'l1',
    bodyText: 'あなたの言葉から、静かな強さを感じました。'.repeat(8),
    ...NO_JAR_POS,
  },
});

function Harness(props: Props) {
  const [detent, setDetent] = useState<DockDetent>(props.detent);
  const [questionId, setQuestionId] = useState<string | null>(props.questions[0]?.id ?? null);
  const [roundId, setRoundId] = useState<string | null>(props.rounds[0]?.id ?? null);
  return (
    <div
      style={{
        position: 'relative',
        width: 390,
        height: 700,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1 }} />
      <SpFermentationDock
        open
        detent={detent}
        onDetentChange={setDetent}
        questions={props.questions}
        questionId={questionId}
        onQuestionChange={setQuestionId}
        rounds={props.rounds}
        roundId={roundId}
        onRoundChange={setRoundId}
        detail={props.detail}
        loading={props.loading}
        onLinkQuestion={() => {}}
      />
    </div>
  );
}

registerUnit<Props>({
  id: 'SpFermentationDock',
  title: 'SpFermentationDock',
  description: '発酵の結果を見ながら書くためのドック（覗く／半分／全画面）',
  kind: 'component',
  render: (props) => withVerifyProviders(<Harness {...props} />),
  fixtures: [
    {
      id: 'peek',
      description: '覗く段（1 行）',
      props: {
        detent: 'peek',
        detail: FULL,
        loading: false,
        questions: ONE_QUESTION,
        rounds: ONE_ROUND,
      },
    },
    {
      id: 'half',
      description: '半分（手紙の冒頭・言葉・抜粋 3 件）',
      props: {
        detent: 'half',
        detail: FULL,
        loading: false,
        questions: TWO_QUESTIONS,
        rounds: THREE_ROUNDS,
      },
    },
    {
      id: 'full',
      description: '全画面（全文・抜粋 4 件）',
      props: {
        detent: 'full',
        detail: FULL,
        loading: false,
        questions: ONE_QUESTION,
        rounds: THREE_ROUNDS,
      },
    },
    {
      id: 'loading',
      description: '取得中は骨組み',
      props: { detent: 'half', detail: null, loading: true, questions: ONE_QUESTION, rounds: [] },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 結果が無ければ「まだ無い」だけ（行き止まりにしない）',
      props: {
        detent: 'half',
        detail: makeDetail({}),
        loading: false,
        questions: ONE_QUESTION,
        rounds: ONE_ROUND,
      },
    },
    {
      id: 'no-question',
      probe: true,
      description: 'Probe: 問いを結ぶ前でも出て、結ぶと何が出るかと結ぶ入口を出す',
      props: { detent: 'half', detail: null, loading: false, questions: [], rounds: [] },
    },
    {
      id: 'pick-older-round',
      probe: true,
      description: 'Probe: 日付を押すとその回を見る',
      props: {
        detent: 'half',
        detail: FULL,
        loading: false,
        questions: TWO_QUESTIONS,
        rounds: THREE_ROUNDS,
      },
      act: async (ctx) => {
        await ctx.click('[data-result-round="ferm-0"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'peek-tap-opens',
      probe: true,
      description: 'Probe: 覗く段を押すと半分へ',
      props: {
        detent: 'peek',
        detail: FULL,
        loading: false,
        questions: ONE_QUESTION,
        rounds: ONE_ROUND,
      },
      act: async (ctx) => {
        await ctx.tap('[data-dock-peek]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'no-redundant-heading',
      description: '覗く段に「発酵の結果」の見出しを出さない（パレットの名前の繰り返し）',
      check: ({ root }) => {
        const peek = root.querySelector('[data-dock-peek]');
        const heading = [...(peek?.querySelectorAll('*') ?? [])].some(
          (el) => (el.textContent ?? '').trim() === '発酵の結果',
        );
        return !heading || '覗く段に「発酵の結果」の見出しがある';
      },
    },
    {
      id: 'pickers-when-many',
      description: '結んだ問いが複数なら問いを、発酵が複数回なら日付を選べる',
      check: ({ root, props }) => {
        const questionChips = root.querySelectorAll('[data-result-question]').length;
        const roundChips = root.querySelectorAll('[data-result-round]').length;
        const wantQuestions = props.questions.length > 1 ? props.questions.length : 0;
        const wantRounds =
          props.questions.length > 0 && props.rounds.length > 1 ? props.rounds.length : 0;
        return (
          (questionChips === wantQuestions && roundChips === wantRounds) ||
          `問い ${questionChips}（期待 ${wantQuestions}）/ 日付 ${roundChips}（期待 ${wantRounds}）`
        );
      },
    },
    {
      id: 'no-snippet-dates',
      description: '抜粋ごとの日付は出さない（日付は上で回ごとに選ぶ）',
      check: ({ root }) => {
        const dated = [...root.querySelectorAll('[data-reading-item="snippet"]')].filter((item) =>
          /\d+月\d+日/.test(item.textContent ?? ''),
        ).length;
        return dated === 0 || `日付のある抜粋 ${dated}`;
      },
    },
    {
      id: 'no-question-offers-link',
      description: '問いが無ければ、結ぶ入口を出す',
      onlyFixtures: ['no-question'],
      check: ({ root, contract }) =>
        (contract.state === 'no-question' &&
          root.querySelector('[data-result-link-question]') !== null) ||
        `state=${contract.state}`,
    },
    {
      id: 'round-picked',
      description: '押した日付の回が選ばれている',
      onlyFixtures: ['pick-older-round'],
      check: ({ root }) =>
        root.querySelector('[data-result-round="ferm-0"]')?.getAttribute('aria-pressed') ===
          'true' || '押した日付が選ばれていない',
    },
    {
      id: 'snippets-all-listed',
      description: '抜粋は段に関わらず全部並ぶ（段で中身の高さを変えない）',
      check: ({ root, contract }) => {
        const items = root.querySelectorAll('[data-reading-item="snippet"]').length;
        return (
          items === Number(contract.snippetCount) ||
          `抜粋 ${items} 件（契約 ${contract.snippetCount}）`
        );
      },
    },
    {
      id: 'skeleton-while-loading',
      description: '取得中は骨組みが出る',
      onlyFixtures: ['loading'],
      check: ({ root }) => root.querySelectorAll('.animate-pulse').length > 0 || '骨組みが無い',
    },
    {
      id: 'peek-tap-goes-half',
      description: '覗く段を押したら半分',
      onlyFixtures: ['peek-tap-opens'],
      check: ({ contract }) => contract.detent === 'half' || `detent=${contract.detent}`,
    },
  ],
});
