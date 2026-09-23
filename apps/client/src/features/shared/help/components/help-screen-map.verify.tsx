/**
 * HelpScreenMap の検証スペック。
 *
 * 見張るのは「画面の部品が全部描かれ、それぞれに札があって押せる」こと、灯っている物が
 * 1 つだけ強く描かれること、線には手描きの揺れ（filter）が掛かり、字には掛からないこと。
 * 書斎だけでなく、瓶・書く・ボード・一覧・問いの変遷にも図がある。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { screenParts } from '../topics';
import type { HelpTopicId } from '../types';
import { HelpScreenMap, hasScreenDrawing } from './help-screen-map';

interface Props {
  screen: HelpTopicId;
  active: HelpTopicId | null;
  pinned: HelpTopicId | null;
}

/** 書斎の札は 3D の注釈と同じ字（`study.label_*`）。他の画面は画面に出ている名前（`help.map`）。 */
function labelsFor(screen: HelpTopicId): ReadonlyMap<HelpTopicId, string> {
  const study: Record<string, string> = {
    jar: jaMessages.study.label_jar,
    notebook: jaMessages.study.label_journal,
    board: jaMessages.study.label_board,
    archive: jaMessages.study.label_archive,
    write: jaMessages.study.label_pen,
  };
  const map: Record<string, Record<string, string>> = jaMessages.help.map;
  const topics: Record<string, { title: string }> = jaMessages.help.topics;
  return new Map(
    screenParts(screen).map((part): [HelpTopicId, string] => [
      part,
      screen === 'study'
        ? (study[part] ?? part)
        : (map[screen]?.[part] ?? topics[part]?.title ?? part),
    ]),
  );
}

const SCREENS: HelpTopicId[] = ['study', 'jar', 'write', 'board', 'list', 'questions'];

registerUnit<Props>({
  id: 'HelpScreenMap',
  title: 'HelpScreenMap',
  description:
    '画面の見取り図。手描きの線で、物ごとに触れられる（書斎・瓶・書く・ボード・一覧・問いの変遷）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div className="w-[300px] p-3" style={{ background: 'var(--surface-raised)' }}>
        <HelpScreenMap
          screen={props.screen}
          parts={screenParts(props.screen)}
          labels={labelsFor(props.screen)}
          title={props.screen}
          active={props.active}
          pinned={props.pinned}
          onHover={() => {}}
          onPress={() => {}}
        />
      </div>,
    ),
  fixtures: [
    {
      id: 'study',
      probe: true,
      description: 'Probe: 書斎。何も灯っていない',
      props: { screen: 'study', active: null, pinned: null },
    },
    {
      id: 'study-jar',
      probe: true,
      description: 'Probe: 書斎で瓶が灯っている',
      props: { screen: 'study', active: 'jar', pinned: null },
    },
    {
      id: 'study-pinned',
      description: '書斎で板を留めてある',
      props: { screen: 'study', active: 'board', pinned: 'board' },
    },
    ...SCREENS.filter((s) => s !== 'study').map((screen) => ({
      id: screen,
      probe: true,
      description: `Probe: ${screen} の見取り図`,
      props: { screen, active: null, pinned: null } satisfies Props,
    })),
    {
      id: 'write-pickle',
      description: '書く画面でパレット（漬け込む）が灯っている',
      props: { screen: 'write', active: 'pickle', pinned: null },
    },
  ],
  invariants: [
    {
      id: 'every-part-is-drawn-and-labelled',
      description: '画面の部品が全部描かれ、それぞれに札があり、押せる',
      check: ({ root, props, contract }) => {
        if (!hasScreenDrawing(props.screen)) return `${props.screen} に図が無い`;
        const parts = screenParts(props.screen);
        const labels = labelsFor(props.screen);
        const groups = [...root.querySelectorAll('[data-part]')];
        if (groups.length !== parts.length) return `${groups.length} 個（期待 ${parts.length}）`;
        if (contract.parts !== parts.join(',')) return `契約 parts=${contract.parts}`;
        for (const g of groups) {
          const id = g.getAttribute('data-part') ?? '';
          const label = labels.get(parts.find((p) => p === id) ?? 'help') ?? '';
          if (!g.querySelector('text')?.textContent?.includes(label))
            return `${id} に札「${label}」が無い`;
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
