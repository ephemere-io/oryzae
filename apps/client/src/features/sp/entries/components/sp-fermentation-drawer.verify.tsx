/**
 * SpFermentationDrawer の検証スペック（Issue #466 の SP 版）。
 *
 * detail は props で受け取るのでデータ取得に依存せず孤立検証できる。開閉は制御 props
 * （open / onOpenChange）なので、開いた状態は fixture で直接与える。項目の展開だけが
 * 内部 state で、act.click で駆動する。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpFermentationDrawer } from './sp-fermentation-drawer';

interface Props {
  detail: FermentationDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DRAWER_SELECTOR = '[data-verify-unit="SpFermentationDrawer"]';
const NO_JAR_POS = { jarX: null, jarY: null };
const noop = () => {};

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
    // main の型集約で必須になったフィールド。ドロワーはまだ使わないので空で埋める。
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
    sourceDate: '2026-05-01',
    selectionReason: 'この一節を選んだ理由。',
    ...NO_JAR_POS,
  };
}

const fullDetail = makeDetail({
  keywords: [keyword('k1', '静けさ'), keyword('k2', '余白')],
  snippets: [snippet('s1', '朝の光が差し込む台所で、ゆっくりとコーヒーを淹れる時間が好きだ。')],
  letter: { id: 'l1', bodyText: 'あなたの言葉から、静かな強さを感じました。', ...NO_JAR_POS },
});

registerUnit<Props>({
  id: 'SpFermentationDrawer',
  title: 'SpFermentationDrawer',
  description: 'SP エントリー画面の発酵ドロワー（下から開き、手紙/キーワード/スニペットを出す）',
  kind: 'component',
  render: (props) => withVerifyProviders(<SpFermentationDrawer {...props} />),
  fixtures: [
    {
      id: 'closed',
      description: '閉じている（ハンドルだけ。本文の邪魔をしない）',
      props: { detail: fullDetail, open: false, onOpenChange: noop },
    },
    {
      id: 'open',
      description: '開いている（手紙・キーワード2件・スニペット1件）',
      props: { detail: fullDetail, open: true, onOpenChange: noop },
    },
    {
      id: 'letter-expanded',
      description: '手紙を押して本文が展開した状態',
      props: { detail: fullDetail, open: true, onOpenChange: noop },
      act: async ({ click, wait }) => {
        await click(`${DRAWER_SELECTOR} button[aria-expanded="false"]`);
        await wait(0);
      },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 完了済みだが中身が空（空状態の文言が出て崩れない）',
      props: { detail: makeDetail({}), open: true, onOpenChange: noop },
    },
    {
      id: 'over-cap',
      probe: true,
      description: 'Probe: cap 超過（キーワード8件・スニペット6件）でも 5/3 件に頭打ちになる',
      props: {
        detail: makeDetail({
          keywords: Array.from({ length: 8 }, (_, i) => keyword(`k${i}`, `言葉${i}`)),
          snippets: Array.from({ length: 6 }, (_, i) =>
            snippet(`s${i}`, `${'長い抜粋のテキスト'.repeat(5)}${i}`),
          ),
        }),
        open: true,
        onOpenChange: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'open-contract-matches-props',
      description: 'open 契約が props と一致する（開閉は制御 props で決まる）',
      check: ({ contract, props }) =>
        contract.open === String(props.open) || `open=${contract.open}, 期待=${props.open}`,
    },
    {
      id: 'closed-hides-content',
      description: '閉じているときは中身を描かない（ハンドルだけ＝本文を隠さない）',
      onlyFixtures: ['closed'],
      check: ({ root }) => {
        const drawer = root.querySelector(DRAWER_SELECTOR);
        if (!drawer) return 'SpFermentationDrawer の契約要素が見つからない';
        const buttons = drawer.querySelectorAll('button').length;
        return buttons === 1 || `閉じているのにボタンが ${buttons} 個ある（ハンドルのみのはず）`;
      },
    },
    {
      id: 'keyword-cap',
      description: 'キーワードは最大5件に頭打ちされ、契約が描画数と一致する',
      check: ({ contract, props }) => {
        const expected = Math.min(props.detail.keywords.length, 5);
        return (
          Number(contract.keywordCount) === expected ||
          `keywordCount=${contract.keywordCount}, 期待=${expected}`
        );
      },
    },
    {
      id: 'snippet-cap',
      description: 'スニペットは最大3件に頭打ちされ、契約が描画数と一致する',
      check: ({ contract, props }) => {
        const expected = Math.min(props.detail.snippets.length, 3);
        return (
          Number(contract.snippetCount) === expected ||
          `snippetCount=${contract.snippetCount}, 期待=${expected}`
        );
      },
    },
    {
      id: 'empty-contract-matches',
      description: 'empty 契約が「手紙もキーワードもスニペットも無い」と一致する',
      check: ({ contract }) => {
        const derived =
          Number(contract.keywordCount) === 0 &&
          Number(contract.snippetCount) === 0 &&
          contract.hasLetter === 'false';
        return (
          contract.empty === String(derived) ||
          `empty=${contract.empty} だが中身から導かれる値は ${derived}`
        );
      },
    },
    {
      id: 'expanding-an-item-is-recorded',
      description: '項目を押すと expandedItem 契約が none 以外になる',
      onlyFixtures: ['letter-expanded'],
      check: ({ contract }) =>
        contract.expandedItem !== 'none' ||
        '項目を押したのに expandedItem が none のまま（展開が state に乗っていない）',
    },
  ],
});
