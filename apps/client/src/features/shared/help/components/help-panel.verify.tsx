/**
 * HelpPanel の検証スペック。
 *
 * 面は 2 つの顔を持つ: **一覧**（検索欄が空。生きている 1 枚 → 話題の列）と
 * **検索**（書いている間は近い話題だけ）。見張るのは、顔が契約（mode）どおりに
 * 切り替わること、頭の 1 枚が触れているものを映すこと、そして**言葉で説明しない**こと
 * （面の名前・節の見出し・使い方の説明を置かない）。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { helpTextsFrom } from '../hooks/use-help-texts';
import { HELP_TOPICS, screenParts } from '../topics';
import type { HelpMatch, HelpRemoteState, HelpTopicId, HelpTutorial } from '../types';
import { HelpPanel } from './help-panel';

interface Props {
  hovered: HelpTopicId | null;
  screenTopic: HelpTopicId;
  focused: HelpTopicId | null;
  query: string;
  matches: HelpMatch[];
  remote: HelpRemoteState;
  spotlight?: boolean;
  tutorial?: HelpTutorial;
}

function lookup(key: string): string {
  const [id, field] = key.split('.');
  const topics: Record<string, Record<string, string>> = jaMessages.help.topics;
  return topics[id ?? '']?.[field ?? ''] ?? key;
}

const TEXTS = helpTextsFrom(lookup);
const PANEL = '[data-verify-unit="HelpPanel"]';
const CARD = '[data-verify-unit="HelpTopicCard"]';
const SCREEN = '[data-verify-unit="HelpScreenCard"]';
const TUTORIAL = '[data-verify-unit="HelpTutorial"]';

/** 面の見出し・使い方の説明として書いてはいけない語。話題の題（「このヘルプの使い方」）は別。 */
const LECTURE_WORDS = [
  'はじめに',
  '書斎のもの',
  '困ったとき',
  'いま触れている',
  'いま開いている',
  'カーソルを載せる',
  'ようこそ',
];

const BROWSE: Props = {
  hovered: null,
  screenTopic: 'concept',
  focused: null,
  query: '',
  matches: [],
  remote: 'idle',
};

registerUnit<Props>({
  id: 'HelpPanel',
  title: 'HelpPanel',
  description:
    'ヘルプの面の中身。検索欄・画面の 1 枚・チュートリアル・話題の一覧（並びは変わらない）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div className="h-[720px] w-[336px] pt-5" style={{ background: 'var(--surface-sunken)' }}>
        <HelpPanel
          texts={TEXTS}
          hovered={props.hovered}
          screenTopic={props.screenTopic}
          focused={props.focused}
          onFocus={() => {}}
          query={props.query}
          onQueryChange={() => {}}
          matches={props.matches}
          remote={props.remote}
          onClose={() => {}}
          onOpenHref={() => {}}
          spotlight={props.spotlight}
          tutorial={props.tutorial}
        />
      </div>,
    ),
  fixtures: [
    { id: 'browse', description: '一覧。何にも触れていない（画面の話題が頭）', props: BROWSE },
    {
      id: 'tutorial-first',
      probe: true,
      description: 'Probe: チュートリアルの①が脈打つ。並びも検索欄も変わらない',
      props: {
        ...BROWSE,
        tutorial: {
          step: 'question',
          done: { question: false, write: false, link: false, pickle: false, read: false },
        },
      },
    },
    {
      id: 'tutorial-done',
      description: '全部済み — チュートリアルは閉じて見出しだけ。並びは同じ',
      props: {
        ...BROWSE,
        tutorial: {
          step: null,
          done: { question: true, write: true, link: true, pickle: true, read: true },
        },
      },
    },
    {
      id: 'spotlight',
      probe: true,
      description: 'Probe: 「ようこそ」の間 — 三歩だけ明るく、他は薄い',
      props: { ...BROWSE, spotlight: true },
    },
    { id: 'hovered', description: '瓶に触れている', props: { ...BROWSE, hovered: 'jar' } },
    {
      id: 'row-open',
      description: '一覧の 1 行を開いている',
      props: { ...BROWSE, focused: 'write' },
    },
    {
      id: 'search',
      description: '検索。Jev の選んだ 1 件が先頭',
      props: {
        ...BROWSE,
        query: '手紙はいつ届く',
        matches: [
          { id: 'letter', score: Number.POSITIVE_INFINITY, source: 'jev' },
          { id: 'pickle', score: 5, source: 'local' },
        ],
        remote: 'answered',
      },
    },
    {
      id: 'search-empty',
      probe: true,
      description: 'Probe: 近い話題が無い',
      props: { ...BROWSE, query: 'xyz', matches: [] },
    },
    {
      id: 'search-asking',
      probe: true,
      description: 'Probe: 手元に無く、Jev に訊いている最中',
      props: { ...BROWSE, query: 'ふわふわ', matches: [], remote: 'asking' },
    },
  ],
  invariants: [
    {
      id: 'mode-contract',
      description: '検索欄に文字があれば search、無ければ browse',
      check: ({ contract, props }) => {
        const expected = props.query.trim().length > 0 ? 'search' : 'browse';
        return contract.mode === expected || `mode=${contract.mode}, 期待=${expected}`;
      },
    },
    {
      id: 'browse-lists-every-topic',
      description:
        '一覧では「はじめに」以外の全話題が並び、「はじめに」はチュートリアルとして上に居る',
      check: ({ root, contract }) => {
        if (contract.mode !== 'browse') return true;
        const expected = HELP_TOPICS.filter((t) => t.section !== 'start').length;
        const count = root.querySelectorAll(CARD).length;
        if (count !== expected) return `${count} 件（期待 ${expected}）`;
        return root.querySelector(TUTORIAL) !== null || 'チュートリアルが無い';
      },
    },
    {
      id: 'search-lists-matches-only',
      description: '検索では近い話題だけ（件数は契約と一致）。画面の 1 枚もチュートリアルも出ない',
      check: ({ root, contract }) => {
        if (contract.mode !== 'search') return true;
        if (root.querySelector(SCREEN)) return '検索中に画面の 1 枚が残っている';
        if (root.querySelector(TUTORIAL)) return '検索中にチュートリアルが残っている';
        const count = root.querySelectorAll(CARD).length;
        return (
          String(count) === contract.resultCount || `${count} 件、契約 ${contract.resultCount}`
        );
      },
    },
    {
      id: 'screen-card-stays-and-lights-the-part',
      description:
        '頭の 1 枚はいま開いている画面。触れているものが部品なら、その札が灯るだけで 1 枚は入れ替わらない',
      check: ({ root, props, contract }) => {
        if (contract.mode !== 'browse') return true;
        const card = root.querySelector(SCREEN);
        if (card?.getAttribute('data-verify-screen') !== props.screenTopic) {
          return `screen=${card?.getAttribute('data-verify-screen')}, 期待=${props.screenTopic}`;
        }
        const parts = screenParts(props.screenTopic);
        const expected =
          props.hovered !== null && parts.includes(props.hovered) ? props.hovered : 'none';
        return (
          card.getAttribute('data-verify-active') === expected ||
          `active=${card.getAttribute('data-verify-active')}, 期待=${expected}`
        );
      },
    },
    {
      id: 'structure-never-changes',
      description:
        '検索欄 → 画面の 1 枚 → チュートリアル → 一覧。チュートリアルの最中も済んだ後も同じ。検索欄はいつも居る',
      check: ({ root, contract }) => {
        if (root.querySelector('input[type="search"]') === null) return '検索欄が無い';
        if (contract.mode !== 'browse') return true;
        const card = root.querySelector(SCREEN);
        const tutorial = root.querySelector(TUTORIAL);
        const firstRow = root.querySelector(CARD);
        if (!card || !tutorial || !firstRow) return '1 枚かチュートリアルか一覧が無い';
        const before = (a: Element, b: Element) =>
          Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        return (before(card, tutorial) && before(tutorial, firstRow)) || '並びが違う';
      },
    },
    {
      id: 'no-labels-no-lecture',
      description: '面の名前・節の見出し・使い方の説明を書かない（見れば分かることを言葉にしない）',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        const found = LECTURE_WORDS.filter((w) => text.includes(w));
        return found.length === 0 || `説明のための言葉が残っている: ${found.join(', ')}`;
      },
    },
    {
      id: 'spotlight-dims-everything-but-the-steps',
      description: 'spotlight の間、画面の 1 枚と一覧は薄く、チュートリアルは灯る',
      check: ({ root, props, contract }) => {
        if (contract.mode !== 'browse') return true;
        const card = root.querySelector(SCREEN);
        const dimmed = card?.parentElement?.className.includes('opacity-30') ?? false;
        const lit =
          root.querySelector(TUTORIAL)?.parentElement?.className.includes('help-spot') ?? false;
        const expected = props.spotlight === true;
        return (
          (dimmed === expected && lit === expected) ||
          `dimmed=${dimmed}, lit=${lit}, 期待=${expected}`
        );
      },
    },
    {
      id: 'search-box-shows-query',
      description: '検索欄には書いた文がそのまま入っている',
      check: ({ root, props }) => {
        const input = root.querySelector<HTMLInputElement>(`${PANEL} input[type="search"]`);
        return input?.value === props.query || `value=${input?.value}`;
      },
    },
    {
      id: 'empty-search-says-so',
      description: '近い話題が無ければ、そう言う（黙って空にしない）',
      check: ({ root, props, contract }) => {
        if (contract.mode !== 'search' || props.matches.length > 0) return true;
        const text = root.textContent ?? '';
        const expected =
          props.remote === 'asking' ? jaMessages.help.search_asking : jaMessages.help.search_empty;
        return text.includes(expected) || `文言が無い: ${expected}`;
      },
    },
  ],
});
