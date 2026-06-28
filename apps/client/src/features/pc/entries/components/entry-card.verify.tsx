/**
 * EntryCard の検証スペック。
 * props だけで孤立レンダリングできる表示カード（i18n + next/link + 任意の削除コールバック）。
 * 状態（charCount / 紐づく問いの有無 / 削除可否 / 検索ハイライト）を data-verify-* として
 * 公表し、契約 ↔ DOM の一致を invariant で検証する。
 * - 内部に next/navigation フック・データ取得は無く、唯一の操作は子の kebab メニュー。
 * - Issue #323: linkedQuestions のうち currentText が null/空のものは省略して連結する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { EntryCard } from './entry-card';

interface LinkedQuestion {
  id: string;
  currentText: string | null;
}

interface Props {
  id: string;
  content: string;
  createdAt: string;
  linkedQuestions?: LinkedQuestion[];
  searchQuery?: string;
  onDeleteClick?: (id: string) => void;
}

const noop = (_id: string): void => {};

registerUnit<Props>({
  id: 'EntryCard',
  title: 'EntryCard',
  description: 'ジャーナルのエントリ表示カード（日付・問い・本文プレビュー・文字数・削除メニュー）',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryCard {...props} />),
  fixtures: [
    {
      id: 'basic',
      description: '本文のみ（複数行・削除可）',
      props: {
        id: 'e1',
        content: '今日の振り返り\nよく眠れた。朝の散歩が気持ちよかった。',
        createdAt: '2026-06-01T09:00:00.000Z',
        onDeleteClick: noop,
      },
    },
    {
      id: 'with-linked-question',
      description: '紐づく問いあり（問い: ラベルが表示される）',
      props: {
        id: 'e2',
        content: '問いに答える本文。\nいくつかの気づきを書いた。',
        createdAt: '2026-06-02T09:00:00.000Z',
        linkedQuestions: [
          { id: 'q1', currentText: '今、何にいちばん時間を使いたい？' },
          { id: 'q2', currentText: '昨日できなかったことは？' },
        ],
        onDeleteClick: noop,
      },
    },
    {
      id: 'read-only',
      description: '削除コールバックなし（kebab メニュー非表示）',
      props: {
        id: 'e3',
        content: '読み取り専用のエントリ。',
        createdAt: '2026-06-03T09:00:00.000Z',
      },
    },
    {
      id: 'search-highlight',
      description: '検索ハイライト（一致語を mark で強調）',
      props: {
        id: 'e4',
        content: '散歩のメモ\n散歩は習慣になりつつある。',
        createdAt: '2026-06-04T09:00:00.000Z',
        searchQuery: '散歩',
        onDeleteClick: noop,
      },
    },
    {
      id: 'null-questions-only',
      probe: true,
      description: 'Probe(#323): linkedQuestions が全て currentText=null → 問い: ラベルは出ない',
      props: {
        id: 'e5',
        content: 'validated transaction 前の問いに紐づくエントリ。',
        createdAt: '2026-06-05T09:00:00.000Z',
        linkedQuestions: [
          { id: 'q3', currentText: null },
          { id: 'q4', currentText: '' },
        ],
        onDeleteClick: noop,
      },
    },
    {
      id: 'empty-content',
      probe: true,
      description: 'Probe: 本文が空でもクラッシュせず charCount=0 で描画される',
      props: {
        id: 'e6',
        content: '',
        createdAt: '2026-06-06T09:00:00.000Z',
      },
    },
    {
      id: 'overflow-content',
      probe: true,
      description: 'Probe: 超長文でもレイアウトが崩れない（preview は 3 行クランプ）',
      props: {
        id: 'e7',
        content: `${'あ'.repeat(150)}\n${'い'.repeat(2000)}`,
        createdAt: '2026-06-07T09:00:00.000Z',
        onDeleteClick: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'charcount-matches-content',
      description: 'contract.charCount が content.length と一致し、文字数ラベルにも描画される',
      check: ({ root, contract, props }) => {
        const expected = props.content.length;
        if (contract.charCount !== String(expected)) {
          return `charCount 契約不一致: content.length=${expected}, contract.charCount=${contract.charCount}`;
        }
        return (
          Boolean(root.textContent?.includes(String(expected))) ||
          `文字数 ${expected} が描画されていない`
        );
      },
    },
    {
      id: 'deletable-matches-kebab',
      description:
        'contract.deletable と kebab メニュー(button[aria-haspopup="menu"])の有無が一致する',
      check: ({ root, contract }) => {
        const hasKebab = Boolean(root.querySelector('button[aria-haspopup="menu"]'));
        const claimed = contract.deletable === 'true';
        return (
          hasKebab === claimed ||
          `deletable 契約不一致: contract.deletable=${contract.deletable}, kebab描画=${hasKebab}`
        );
      },
    },
    {
      id: 'linked-question-label-matches-contract',
      description:
        'contract.hasQuestions が true のときだけ「問い:」ラベルが描画される（#323 のフィルタ契約）',
      check: ({ root, contract }) => {
        const labelShown = Boolean(root.textContent?.includes('問い:'));
        const claimed = contract.hasQuestions === 'true';
        return (
          labelShown === claimed ||
          `問いラベル不一致: contract.hasQuestions=${contract.hasQuestions}, ラベル描画=${labelShown}`
        );
      },
    },
    {
      id: 'null-questions-not-rendered',
      description: 'currentText が全て null/空なら問いは連結されず hasQuestions=false',
      onlyFixtures: ['null-questions-only'],
      check: ({ root, contract }) =>
        (contract.hasQuestions === 'false' && !root.textContent?.includes('問い:')) ||
        `null のみの問いがラベル表示されている: hasQuestions=${contract.hasQuestions}`,
    },
    {
      id: 'highlight-preserves-text',
      description:
        '検索ハイライト時も本文テキストは欠落しない（mark で分割されても textContent は保たれる）',
      onlyFixtures: ['search-highlight'],
      check: ({ root, contract }) => {
        const hasMark = Boolean(root.querySelector('mark'));
        const keepsTerm = Boolean(root.textContent?.includes('散歩'));
        return (
          (contract.hasSearch === 'true' && hasMark && keepsTerm) ||
          `ハイライト不一致: hasSearch=${contract.hasSearch}, mark=${hasMark}, 語保持=${keepsTerm}`
        );
      },
    },
  ],
});
