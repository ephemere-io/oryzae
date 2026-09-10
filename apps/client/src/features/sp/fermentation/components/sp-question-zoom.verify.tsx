/**
 * SpQuestionZoom の検証スペック（円をひとつ開いた画面）。
 *
 * detail / loading は props なので、状態機械（読込中 / 発酵前 / 中身あり）を props だけで
 * 再現できる。ここで守るのは「**円の中で中身を読ませない**」という設計そのもの:
 * 言葉・抜粋・手紙はすべて押せる要素であって、本文はここに出ない。
 *
 * i18n（sp.jar）依存のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
import { textPathFitsInvariant } from '@/lib/verify/text-path-invariant';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpQuestionZoom } from './sp-question-zoom';

interface Props {
  questionText: string;
  detail: FermentationDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpenElement: () => void;
}

const noop = () => {};

const LETTER_BODY = 'あなたの言葉から、静かな喜びが立ち上っています。';
const KEYWORD_DESCRIPTION = '小さなことに気づく力。';

const filled: FermentationDetail = {
  id: 'f-1',
  questionId: 'q-1',
  targetPeriod: '2026-06',
  status: 'completed',
  worksheet: null,
  letter: { id: 'l-1', bodyText: LETTER_BODY, jarX: null, jarY: null },
  keywords: [
    { id: 'k-1', keyword: '感謝', description: KEYWORD_DESCRIPTION, jarX: null, jarY: null },
    { id: 'k-2', keyword: '余白', description: '', jarX: null, jarY: null },
  ],
  snippets: [
    {
      id: 's-1',
      snippetType: 'core',
      originalText: '朝の光がきれいだった',
      sourceDate: '2026-06-18T00:00:00.000Z',
      selectionReason: '同じ光景が三度出てくる。',
      jarX: null,
      jarY: null,
    },
  ],
  scannedEntries: [],
};

const many: FermentationDetail = {
  ...filled,
  keywords: Array.from({ length: 9 }, (_, i) => ({
    id: `k-${i}`,
    keyword: `言葉${i}`,
    description: '',
    jarX: null,
    jarY: null,
  })),
  snippets: Array.from({ length: 7 }, (_, i) => ({
    id: `s-${i}`,
    snippetType: 'core' as const,
    originalText: `抜粋${i}`,
    sourceDate: '2026-06-18T00:00:00.000Z',
    selectionReason: '',
    jarX: null,
    jarY: null,
  })),
};

/** 問いの上限ちょうど（MAX_QUESTION_STRING_LENGTH = 64 字）。 */
const LONG_QUESTION =
  'ここ数ヶ月のあいだに自分のなかで静かに変わってしまったものは何だったのか、それをいまあらためて言葉にするとどんな形になるだろうか';

registerUnit<Props>({
  id: 'SpQuestionZoom',
  title: 'SpQuestionZoom',
  description: '開いた問いの円。言葉・抜粋・手紙がそれぞれ押せる（読むのはシート側）。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '640px' }}>
        <SpQuestionZoom {...props} onOpenElement={props.onOpenElement} />
      </div>,
    ),
  fixtures: [
    {
      id: 'filled',
      description: '言葉2・抜粋1・手紙あり（中身が揃った円）',
      props: {
        questionText: '最近うれしかったことは？',
        detail: filled,
        loading: false,
        onClose: noop,
        onOpenElement: noop,
      },
    },
    {
      id: 'loading',
      probe: true,
      description: 'Probe: 取得中は「まだ発酵していません」を出さない（誤解させない）',
      props: {
        questionText: '最近うれしかったことは？',
        detail: null,
        loading: true,
        onClose: noop,
        onOpenElement: noop,
      },
    },
    {
      id: 'not-fermented',
      probe: true,
      description: 'Probe: 発酵前は空の円ではなく理由を出す',
      props: {
        questionText: '最近うれしかったことは？',
        detail: null,
        loading: false,
        onClose: noop,
        onOpenElement: noop,
      },
    },
    {
      id: 'long-question',
      probe: true,
      description: 'Probe: 上限いっぱい（64 字）の問いも、輪を増やして全文を出す',
      props: {
        questionText: LONG_QUESTION,
        detail: filled,
        loading: false,
        onClose: noop,
        onOpenElement: noop,
      },
    },
    {
      id: 'overflow',
      probe: true,
      description: 'Probe: 言葉9・抜粋7 でも上限までしか置かない（指で選び分けられる数）',
      props: {
        questionText: '最近うれしかったことは？',
        detail: many,
        loading: false,
        onClose: noop,
        onOpenElement: noop,
      },
    },
  ],
  invariants: [
    textPathFitsInvariant(),
    {
      id: 'question-is-never-cut',
      description: '問いは切らない（どの問いを開いているかを語る場所なので）',
      check: ({ root }) => {
        const folded = Array.from(root.querySelectorAll('textPath'))
          .map((path) => path.textContent ?? '')
          .filter((text) => text.endsWith('…'));
        return folded.length === 0 || `${folded.length} 個の問いが畳まれている`;
      },
    },
    {
      id: 'long-question-reads-whole',
      description: '上限いっぱいの問いも、輪をつなぐと全文になる',
      onlyFixtures: ['long-question'],
      check: ({ root }) => {
        const rings = Array.from(root.querySelectorAll('textPath'));
        // 円は採寸してから描く（`size > 0`）。版組みの無い jsdom では輪が出ないので、
        // そこでは判定できない。輪の分け方そのものは ring-text.test.ts が見ている。
        if (rings.length === 0) return true;
        const read = rings.map((path) => path.textContent ?? '').join('');
        return (
          read === LONG_QUESTION || `全文にならない（${read.length}/${LONG_QUESTION.length} 字）`
        );
      },
    },
    {
      id: 'element-buttons-match-contract',
      description: '押せる要素の数が契約（言葉＋抜粋＋手紙）と一致する',
      check: ({ root, contract }) => {
        const buttons = root.querySelectorAll('[data-verify-unit="SpQuestionZoom"] button').length;
        // header の閉じるボタン + 言葉 + 抜粋 + 手紙。
        const expected =
          1 +
          Number(contract.keywordCount) +
          Number(contract.snippetCount) +
          (contract.hasLetter === 'true' ? 1 : 0);
        return buttons === expected || `押せる要素=${buttons}（期待: ${expected}）`;
      },
    },
    {
      id: 'body-text-stays-out-of-the-circle',
      description: '円の中に本文を出さない（読むのはシート側の仕事）',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        const leaked = [LETTER_BODY, KEYWORD_DESCRIPTION].filter((body) => text.includes(body));
        return leaked.length === 0 || `円の中に本文が出ている: ${leaked.join(' / ')}`;
      },
    },
    {
      id: 'caps-elements',
      description: '数が多くても置く数に上限がある（重なって選べなくなる）',
      onlyFixtures: ['overflow'],
      check: ({ contract }) =>
        (Number(contract.keywordCount) <= 6 && Number(contract.snippetCount) <= 4) ||
        `上限を超えている: 言葉=${contract.keywordCount}, 抜粋=${contract.snippetCount}`,
    },
    {
      id: 'loading-is-not-empty',
      description: '取得中は「まだ発酵していません」を出さない',
      onlyFixtures: ['loading'],
      check: ({ root, contract }) => {
        const saysEmpty = (root.textContent ?? '').includes('まだ発酵していません');
        return (
          (contract.loading === 'true' && contract.empty === 'false' && !saysEmpty) ||
          `loading=${contract.loading}, empty=${contract.empty}, 文言=${saysEmpty}`
        );
      },
    },
    {
      id: 'not-fermented-explains-itself',
      description: '発酵前は空の円ではなく理由を出す',
      onlyFixtures: ['not-fermented'],
      check: ({ root, contract }) => {
        const shown = (root.textContent ?? '').includes('まだ発酵していません');
        return (contract.empty === 'true' && shown) || `empty=${contract.empty}, 文言=${shown}`;
      },
    },
  ],
});
