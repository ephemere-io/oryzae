/**
 * FermentationSidebar の検証スペック（Issue #466）。
 *
 * detail を props で受け取り、手紙・キーワード・スニペットをサイドバーに列挙する部品。
 * データ取得は親（useFermentationForQuestion）が担うので props だけで孤立レンダリングできる。
 *
 * 注意:
 * - FermentationOverlayDetailPane は常時マウントされ、閉じていても閉ボタンが root に存在する。
 *   ボタン数を数える invariant は契約要素（data-verify-unit="FermentationSidebar"）配下に限定する。
 * - キーワードは 5 件、スニペットは 3 件で slice する。契約は **描画済み（cap 後）** の件数を
 *   公表するので、cap 超過 probe でも DOM 件数と一致する。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { FermentationSidebar } from './fermentation-sidebar';

interface Props {
  detail: FermentationDetail;
  onClose: () => void;
}

const SIDEBAR_SELECTOR = '[data-verify-unit="FermentationSidebar"]';

/** 瓶ビュー用の座標。サイドバーは座標を使わないので常に null でよい。 */
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
    selectionReason: '日常の中の幸福を捉えた一節。',
    ...NO_JAR_POS,
  };
}

const fullDetail = makeDetail({
  keywords: [keyword('k1', '静けさ'), keyword('k2', '余白')],
  snippets: [snippet('s1', '朝の光が差し込む台所で、ゆっくりとコーヒーを淹れる時間が好きだ。')],
  letter: { id: 'l1', bodyText: 'あなたの言葉から、静かな強さを感じました。', ...NO_JAR_POS },
});

registerUnit<Props>({
  id: 'FermentationSidebar',
  title: 'FermentationSidebar',
  description: 'エントリー画面の右サイドバー。発酵結果（手紙/キーワード/スニペット）を集約する。',
  kind: 'component',
  render: (props) => withVerifyProviders(<FermentationSidebar {...props} />),
  fixtures: [
    {
      id: 'full',
      description: '手紙・キーワード2件・スニペット1件がすべて揃った状態',
      props: { detail: fullDetail, onClose: noop },
    },
    {
      id: 'letter-only',
      description: '手紙だけが届いている状態',
      props: {
        detail: makeDetail({
          letter: { id: 'l1', bodyText: '今週の言葉を受け取りました。', ...NO_JAR_POS },
        }),
        onClose: noop,
      },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 完了済みだが中身が空（空状態の文言が出て崩れない）',
      props: { detail: makeDetail({}), onClose: noop },
    },
    {
      id: 'over-cap',
      probe: true,
      description: 'Probe: cap 超過（キーワード7件・スニペット5件）でも 5/3 件に頭打ちになる',
      props: {
        detail: makeDetail({
          keywords: Array.from({ length: 7 }, (_, i) => keyword(`k${i}`, `言葉${i}`)),
          snippets: Array.from({ length: 5 }, (_, i) =>
            snippet(`s${i}`, `${'とても長い抜粋のテキスト'.repeat(6)}${i}`),
          ),
        }),
        onClose: noop,
      },
    },
  ],
  invariants: [
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
      id: 'items-are-clickable',
      description: '契約件数の合計 + 閉じるボタン = サイドバー内のボタン総数（全項目が開ける）',
      check: ({ root, contract }) => {
        const sidebar = root.querySelector(SIDEBAR_SELECTOR);
        if (!sidebar) return 'FermentationSidebar の契約要素が見つからない';
        const buttons = sidebar.querySelectorAll('button').length;
        const expected =
          Number(contract.keywordCount) +
          Number(contract.snippetCount) +
          (contract.hasLetter === 'true' ? 1 : 0) +
          1; // 閉じるボタン
        return buttons === expected || `ボタン数=${buttons}, 期待=${expected}`;
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
  ],
});
