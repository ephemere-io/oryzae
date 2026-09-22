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

registerUnit<Props>({
  id: 'HelpTopicCard',
  title: 'HelpTopicCard',
  description: 'ヘルプの一覧の話題 1 件。閉じれば行、開けば本文と「開く」',
  kind: 'component',
  render: (props) => (
    <div className="w-[336px] p-2" style={{ background: 'var(--surface-sunken)' }}>
      <HelpTopicCard
        topic={helpTopic(props.topic)}
        text={textOf(props.topic)}
        expanded={props.expanded}
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
      description: '閉じた行（線画・題・一言）',
      props: { topic: 'jar', expanded: false },
    },
    {
      id: 'expanded',
      description: '開いた行（本文・開く）',
      props: { topic: 'jar', expanded: true },
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
      description: 'expanded 契約は props と一致し、aria-expanded にも出る',
      check: ({ root, contract, props }) => {
        const button = root.querySelector('button[aria-expanded]');
        return (
          (contract.expanded === String(props.expanded) &&
            button?.getAttribute('aria-expanded') === String(props.expanded)) ||
          `expanded=${contract.expanded}, aria=${button?.getAttribute('aria-expanded')}`
        );
      },
    },
    {
      id: 'body-only-when-open',
      description: '本文は開いているときだけ',
      check: ({ root, props }) => {
        const shown = (root.textContent ?? '').includes(textOf(props.topic).body);
        return shown === props.expanded || `本文の有無=${shown}, expanded=${props.expanded}`;
      },
    },
    {
      id: 'open-link-follows-href',
      description: '「開く」は行き先がある話題にだけ出る（開いているとき）',
      check: ({ root, props }) => {
        const link = [...root.querySelectorAll('button')].find((b) =>
          (b.textContent ?? '').startsWith('開く'),
        );
        const expected = props.expanded && helpTopic(props.topic).href !== null;
        return Boolean(link) === expected || `開く=${Boolean(link)}, 期待=${expected}`;
      },
    },
    {
      id: 'row-has-illustration',
      description: '行に線画が付く（一覧を目で流せるように。節の見出しの代わり）',
      check: ({ root }) =>
        root.querySelector('[data-verify-unit="HelpIllustration"]') !== null || '線画が無い',
    },
  ],
});
