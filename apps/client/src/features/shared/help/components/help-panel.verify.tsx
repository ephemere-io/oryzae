/**
 * HelpPanel の検証スペック。
 *
 * 面は 2 つの顔を持つ: **一覧**（検索欄が空。いま触れているもの → 話題の節）と
 * **検索**（書いている間は近い話題だけ）。見張るのは、顔が契約（mode）どおりに
 * 切り替わること、触れているものが頭に来ること、初めての人にだけ「ようこそ」が出ること。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { helpTextsFrom } from '../hooks/use-help-texts';
import { HELP_TOPICS } from '../topics';
import type { HelpMatch, HelpRemoteState, HelpTopicId } from '../types';
import { HelpPanel } from './help-panel';

interface Props {
  hovered: HelpTopicId | null;
  screenTopic: HelpTopicId;
  focused: HelpTopicId | null;
  query: string;
  matches: HelpMatch[];
  remote: HelpRemoteState;
  firstVisit: boolean;
}

function lookup(key: string): string {
  const [id, field] = key.split('.');
  const topics: Record<string, Record<string, string>> = jaMessages.help.topics;
  return topics[id ?? '']?.[field ?? ''] ?? key;
}

const TEXTS = helpTextsFrom(lookup);
const PANEL = '[data-verify-unit="HelpPanel"]';
const CARD = '[data-verify-unit="HelpTopicCard"]';

const BROWSE: Props = {
  hovered: null,
  screenTopic: 'concept',
  focused: null,
  query: '',
  matches: [],
  remote: 'idle',
  firstVisit: false,
};

registerUnit<Props>({
  id: 'HelpPanel',
  title: 'HelpPanel',
  description: 'ヘルプの面の中身。検索欄・いま触れているもの・話題の一覧',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div className="h-[640px] w-[336px] pt-5" style={{ background: 'var(--surface-sunken)' }}>
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
          firstVisit={props.firstVisit}
          shortcutHint
          onClose={() => {}}
          onOpenHref={() => {}}
        />
      </div>,
    ),
  fixtures: [
    { id: 'browse', description: '一覧。何にも触れていない（画面の話題が頭）', props: BROWSE },
    {
      id: 'hovered',
      description: '瓶に触れている',
      props: { ...BROWSE, hovered: 'jar' },
    },
    {
      id: 'first-visit',
      description: '初めての人。「ようこそ」と、最初の話題を開いた状態',
      props: { ...BROWSE, firstVisit: true, focused: 'concept' },
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
      description: '一覧では全話題が並ぶ（頭の 1 件を足して +1）',
      check: ({ root, contract }) => {
        if (contract.mode !== 'browse') return true;
        const count = root.querySelectorAll(CARD).length;
        return count === HELP_TOPICS.length + 1 || `${count} 件（期待 ${HELP_TOPICS.length + 1}）`;
      },
    },
    {
      id: 'search-lists-matches-only',
      description: '検索では近い話題だけ（件数は契約と一致）',
      check: ({ root, contract }) => {
        if (contract.mode !== 'search') return true;
        const count = root.querySelectorAll(CARD).length;
        return (
          String(count) === contract.resultCount || `${count} 件、契約 ${contract.resultCount}`
        );
      },
    },
    {
      id: 'spot-is-hovered-or-screen',
      description: '頭に来るのは、触れているもの。無ければ画面の話題',
      check: ({ root, props, contract }) => {
        if (contract.mode !== 'browse') return true;
        const spot = root.querySelector(`${CARD}[data-verify-spot="true"]`);
        const expected = props.hovered ?? props.screenTopic;
        return (
          spot?.getAttribute('data-verify-topic') === expected ||
          `spot=${spot?.getAttribute('data-verify-topic')}, 期待=${expected}`
        );
      },
    },
    {
      id: 'welcome-only-first-visit',
      description: '「ようこそ」は初めての人にだけ',
      check: ({ root, props, contract }) => {
        if (contract.mode !== 'browse') return true;
        const shown = (root.textContent ?? '').includes(jaMessages.help.welcome_title);
        return shown === props.firstVisit || `ようこそ=${shown}, firstVisit=${props.firstVisit}`;
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
