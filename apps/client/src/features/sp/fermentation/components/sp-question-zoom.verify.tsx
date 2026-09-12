/**
 * SpQuestionZoom の検証スペック（円をひとつ開いた画面）。
 *
 * detail / loading は props なので、状態機械（読込中 / 発酵前 / 中身あり）を props だけで
 * 再現できる。ここで守るのは「**円は見出し、中身はリスト**」という設計:
 * 問いは円の中に全文が書かれ、手紙・言葉・抜粋は縦のリストに読める大きさで並び、
 * 行を押して全文を読む。数が増えても縦に伸びるだけで、重ならず・切れない。
 *
 * i18n（sp.jar）依存のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import type { FermentationDetail } from '@/features/shared/fermentation/types';
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
const SNIPPET_TEXT = '朝の光がきれいだった';

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
      originalText: SNIPPET_TEXT,
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
  description: '開いた問いの円。上に見出しの円、下に手紙・言葉・抜粋のリスト（行を押して全文）。',
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
      description: 'Probe: 発酵前は空のリストではなく理由を出す',
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
      description: 'Probe: 上限いっぱい（64 字）の問いも、見出しの円の中に全文が出る',
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
      description: 'Probe: 言葉9・抜粋7 でも全部並ぶ（リストは縦に伸びるだけで重ならない）',
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
    {
      id: 'question-reads-whole',
      description: '問いは見出しの円の中に全文が出る（切らない・輪にしない）',
      check: ({ root, props }) => {
        const heading = root.querySelector('[data-question-heading]');
        if (!(heading instanceof HTMLElement)) return '見出しの円に問いが無い';
        const text = (heading.textContent ?? '').trim();
        if (text !== props.questionText.trim()) {
          return `問いが全文でない（${text.length}/${props.questionText.length} 字）`;
        }
        // 輪（textPath）は軌道の円だけのもの。開いた画面に残っていたら設計が戻っている。
        return root.querySelector('textPath') === null || '開いた画面に輪の文字が残っている';
      },
    },
    {
      id: 'rows-match-contract',
      description: '押せる行の数が契約（手紙＋言葉＋抜粋）と一致する（上限で落とさない）',
      check: ({ root, contract }) => {
        const rows = root.querySelectorAll('[data-verify-unit="SpQuestionZoom"] li button').length;
        const expected =
          Number(contract.keywordCount) +
          Number(contract.snippetCount) +
          (contract.hasLetter === 'true' ? 1 : 0);
        return rows === expected || `押せる行=${rows}（期待: ${expected}）`;
      },
    },
    {
      id: 'shows-everything',
      description:
        '数が多くても全部並べる（以前は言葉 6・抜粋 4 で切っていて、残りが見えなかった）',
      onlyFixtures: ['overflow'],
      check: ({ contract, props }) =>
        (Number(contract.keywordCount) === (props.detail?.keywords.length ?? 0) &&
          Number(contract.snippetCount) === (props.detail?.snippets.length ?? 0)) ||
        `落としている: 言葉=${contract.keywordCount}, 抜粋=${contract.snippetCount}`,
    },
    {
      id: 'snippet-text-is-readable-in-place',
      description: '抜粋は行の中で本文が読める（開かないと読めない、をやめた）',
      onlyFixtures: ['filled'],
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return text.includes(SNIPPET_TEXT) || '抜粋の本文がリストに出ていない';
      },
    },
    {
      id: 'letter-row-is-findable',
      description: '手紙の行は文字を持たなくても掴める（読み上げにも名前が出る）',
      onlyFixtures: ['filled', 'long-question'],
      check: ({ root }) => {
        const row = root.querySelector('[data-testid="sp-jar-letter"]');
        if (!(row instanceof HTMLElement)) return '手紙の行が無い';
        return Boolean(row.getAttribute('aria-label')) || '手紙の行に名前が無い';
      },
    },
    {
      id: 'body-text-stays-in-the-reader',
      description: '手紙の本文と言葉の説明はここに出さない（読むのは行を押した先）',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        const leaked = [LETTER_BODY, KEYWORD_DESCRIPTION].filter((body) => text.includes(body));
        return leaked.length === 0 || `リストに本文が出ている: ${leaked.join(' / ')}`;
      },
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
      description: '発酵前は空のリストではなく理由を出す',
      onlyFixtures: ['not-fermented'],
      check: ({ root, contract }) => {
        const shown = (root.textContent ?? '').includes('まだ発酵していません');
        return (contract.empty === 'true' && shown) || `empty=${contract.empty}, 文言=${shown}`;
      },
    },
  ],
});
