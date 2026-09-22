/**
 * HelpTopicCard の検証スペック。
 *
 * 見張るのは 3 つ。閉じている行は**題と一言だけ**（本文が漏れない）、開けば本文と
 * 「開く」が出る、行き先の無い話題（このヘルプの使い方）には「開く」が出ない。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { helpTextsFrom } from '../hooks/use-help-texts';
import { helpTopic } from '../topics';
import type { HelpTopicId } from '../types';
import { HelpTopicCard } from './help-topic-card';

interface Props {
  topic: HelpTopicId;
  expanded: boolean;
  spot?: boolean;
  badge?: string;
}

/** ja.json の `help.topics` を、hook を通さずに引く（孤立検証は i18n の provider を持たない）。 */
function lookup(key: string): string {
  const [id, field] = key.split('.');
  const topics: Record<string, Record<string, string>> = jaMessages.help.topics;
  return topics[id ?? '']?.[field ?? ''] ?? key;
}

const TEXTS = helpTextsFrom(lookup);
const textOf = (id: HelpTopicId) => {
  const text = TEXTS.find((t) => t.id === id);
  if (!text) throw new Error(`no text for ${id}`);
  return text;
};

const CARD = '[data-verify-unit="HelpTopicCard"]';

registerUnit<Props>({
  id: 'HelpTopicCard',
  title: 'HelpTopicCard',
  description: 'ヘルプの話題 1 件。閉じれば行、開けば本文と線画と「開く」',
  kind: 'component',
  render: (props) => (
    <div className="w-[300px]" style={{ background: 'var(--surface-sunken)' }}>
      <HelpTopicCard
        topic={helpTopic(props.topic)}
        text={textOf(props.topic)}
        expanded={props.expanded}
        spot={props.spot}
        badge={props.badge}
        onToggle={() => {}}
        openLabel="開く"
        onOpen={() => {}}
      />
    </div>
  ),
  fixtures: [
    {
      id: 'collapsed',
      description: '閉じた行（題と一言）',
      props: { topic: 'jar', expanded: false },
    },
    {
      id: 'expanded',
      description: '開いた行（本文・線画・開く）',
      props: { topic: 'jar', expanded: true },
    },
    {
      id: 'spot',
      description: 'いま触れているもの（紙の面に載せる。常に開いている）',
      props: { topic: 'concept', expanded: false, spot: true },
    },
    {
      id: 'external',
      description: '外へ出る話題（公開サイト）。「開く」に ↗',
      props: { topic: 'support', expanded: true },
    },
    {
      id: 'jev-pick',
      description: 'Jev が選んだ 1 件（印つき）',
      props: { topic: 'letter', expanded: true, badge: 'おすすめ' },
    },
    {
      id: 'no-href',
      probe: true,
      description: 'Probe: 行き先の無い話題を開いても「開く」は出ない',
      props: { topic: 'help', expanded: true },
    },
    {
      id: 'collapsed-keeps-body-hidden',
      probe: true,
      description: 'Probe: 閉じた行に本文が漏れない',
      props: { topic: 'letter', expanded: false },
    },
  ],
  invariants: [
    {
      id: 'expanded-contract',
      description: 'expanded 契約は spot || expanded と一致する',
      check: ({ contract, props }) => {
        const expected = props.spot === true || props.expanded;
        return (
          contract.expanded === String(expected) ||
          `expanded=${contract.expanded}, 期待=${expected}`
        );
      },
    },
    {
      id: 'body-only-when-open',
      description: '本文は開いているときだけ',
      check: ({ root, props, contract }) => {
        const body = textOf(props.topic).body;
        const shown = (root.textContent ?? '').includes(body);
        return (
          shown === (contract.expanded === 'true') ||
          `本文の有無=${shown}, expanded=${contract.expanded}`
        );
      },
    },
    {
      id: 'open-link-follows-href',
      description: '「開く」は行き先がある話題にだけ出る（開いているとき）',
      check: ({ root, props, contract }) => {
        const link = [...root.querySelectorAll('button')].find((b) =>
          (b.textContent ?? '').startsWith('開く'),
        );
        const expected = contract.expanded === 'true' && helpTopic(props.topic).href !== null;
        return Boolean(link) === expected || `開く=${Boolean(link)}, 期待=${expected}`;
      },
    },
    {
      id: 'spot-is-raised',
      description: 'いま触れているものだけ紙の面（surface-raised）に載る',
      check: ({ root, props }) => {
        const el = root.querySelector<HTMLElement>(CARD);
        const raised = (el?.style.background ?? '').includes('surface-raised');
        return raised === (props.spot === true) || `raised=${raised}, spot=${props.spot}`;
      },
    },
  ],
});
