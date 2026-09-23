/**
 * HelpStudyMap の検証スペック。
 *
 * 見張るのは「書斎の物が全部描かれ、それぞれに札があって押せる」こと、灯っている物が
 * 1 つだけ強く描かれること、線には手描きの揺れ（filter）が掛かり、字には掛からないこと。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { screenParts } from '../topics';
import type { HelpTopicId } from '../types';
import { HelpStudyMap } from './help-study-map';

interface Props {
  active: HelpTopicId | null;
  pinned: HelpTopicId | null;
}

const PARTS = screenParts('study');
const TITLED: readonly HelpTopicId[] = [...PARTS, 'study'];
const TITLES: ReadonlyMap<HelpTopicId, string> = new Map(
  TITLED.map((id): [HelpTopicId, string] => {
    const topics: Record<string, { title: string }> = jaMessages.help.topics;
    return [id, topics[id]?.title ?? id];
  }),
);

registerUnit<Props>({
  id: 'HelpStudyMap',
  title: 'HelpStudyMap',
  description: '書斎の縮小図。手描きの線で、物ごとに触れられる',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div className="w-[300px] p-3" style={{ background: 'var(--surface-raised)' }}>
        <HelpStudyMap
          parts={PARTS}
          titles={TITLES}
          active={props.active}
          pinned={props.pinned}
          onHover={() => {}}
          onPress={() => {}}
        />
      </div>,
    ),
  fixtures: [
    {
      id: 'quiet',
      probe: true,
      description: 'Probe: 何も灯っていない',
      props: { active: null, pinned: null },
    },
    {
      id: 'jar',
      probe: true,
      description: 'Probe: 瓶が灯っている',
      props: { active: 'jar', pinned: null },
    },
    {
      id: 'pinned-board',
      description: '板を留めてある（灯っている）',
      props: { active: 'board', pinned: 'board' },
    },
  ],
  invariants: [
    {
      id: 'every-part-is-drawn-and-labelled',
      description: '書斎の物が全部描かれ、それぞれに札（題）があり、押せる',
      check: ({ root, contract }) => {
        const groups = [...root.querySelectorAll('[data-part]')];
        if (groups.length !== PARTS.length) return `${groups.length} 個（期待 ${PARTS.length}）`;
        if (contract.parts !== PARTS.join(',')) return `契約 parts=${contract.parts}`;
        for (const g of groups) {
          const id = g.getAttribute('data-part') ?? '';
          const title = TITLES.get(PARTS.find((p) => p === id) ?? 'study') ?? '';
          if (!g.querySelector('text')?.textContent?.includes(title)) return `${id} に札が無い`;
          if (g.getAttribute('role') !== 'button' || g.getAttribute('tabindex') !== '0')
            return `${id} が押せない`;
          if (g.querySelectorAll('path').length < 2) return `${id} の線が無い`;
        }
        return true;
      },
    },
    {
      id: 'only-the-active-part-is-lit',
      description: '灯っている物は 1 つだけ（無ければ 0）。留めた物は aria-pressed',
      check: ({ root, props, contract }) => {
        const lit = [...root.querySelectorAll('[data-part][data-lit]')].map((g) =>
          g.getAttribute('data-part'),
        );
        const expected = props.active === null ? [] : [props.active];
        if (lit.join(',') !== expected.join(',')) return `灯り=${lit.join(',')}`;
        if (contract.active !== (props.active ?? 'none')) return `契約 active=${contract.active}`;
        const pressed = [...root.querySelectorAll('[data-part][aria-pressed="true"]')].map((g) =>
          g.getAttribute('data-part'),
        );
        return pressed.join(',') === (props.pinned ?? '') || `留め=${pressed.join(',')}`;
      },
    },
    {
      id: 'lines-wobble-text-does-not',
      description: '線には手描きの揺れ（filter）が掛かり、字には掛からない',
      check: ({ root }) => {
        const filter = root.querySelector('filter');
        if (!filter) return 'filter が無い';
        const wobbly = [...root.querySelectorAll('g[filter]')];
        if (wobbly.length === 0) return '揺れている線が無い';
        const text = root.querySelector('text');
        if (text?.hasAttribute('filter')) return '字が揺れている';
        return text?.closest('g[filter]') === null || '字が揺れる g の中にある';
      },
    },
  ],
});
