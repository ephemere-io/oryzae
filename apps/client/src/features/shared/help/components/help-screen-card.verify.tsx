/**
 * HelpScreenCard の検証スペック。
 *
 * 見張るのは「1 枚はいま開いている画面のもので、触れても入れ替わらない」こと、画面の部品の
 * 札が並び、画面の中で触れた部品の札だけが灯って説明が開くこと、部品でないものに触れても
 * 何も起きないこと、そして「開く」のボタンを置かないこと。
 */

import { registerUnit } from '@oryzae/verify';
import { helpTextsFrom } from '@/features/shared/help/hooks/use-help-texts';
import jaMessages from '@/i18n/messages/ja.json';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { helpTopic, screenParts } from '../topics';
import type { HelpTopicId, HelpTopicText } from '../types';
import { HelpScreenCard } from './help-screen-card';

interface Props {
  screen: HelpTopicId;
  hovered: HelpTopicId | null;
}

function lookup(key: string): string {
  const [id, field] = key.split('.');
  const topics: Record<string, Record<string, string>> = jaMessages.help.topics;
  return topics[id ?? '']?.[field ?? ''] ?? key;
}

const TEXTS: ReadonlyMap<HelpTopicId, HelpTopicText> = new Map(
  helpTextsFrom(lookup).map((text) => [text.id, text]),
);

registerUnit<Props>({
  id: 'HelpScreenCard',
  title: 'HelpScreenCard',
  description: '面の頭の 1 枚 — いま開いている画面と、その部品の札（書斎なら縮小図）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div className="w-[336px] p-3" style={{ background: 'var(--bg)' }}>
        <HelpScreenCard
          screen={helpTopic(props.screen)}
          parts={screenParts(props.screen).map(helpTopic)}
          texts={TEXTS}
          hovered={props.hovered}
        />
      </div>,
    ),
  fixtures: [
    {
      id: 'study',
      probe: true,
      description: 'Probe: 書斎。何にも触れていない — 縮小図と部屋の説明',
      props: { screen: 'study', hovered: null },
    },
    {
      id: 'study-jar',
      probe: true,
      description: 'Probe: 書斎で瓶に触れている — 瓶の札が灯って説明が開く',
      props: { screen: 'study', hovered: 'jar' },
    },
    {
      id: 'study-other',
      description: '書斎で部品でないもの（アカウント）に触れている — 何も起きない',
      props: { screen: 'study', hovered: 'account' },
    },
    { id: 'jar', description: '瓶の画面', props: { screen: 'jar', hovered: null } },
    {
      id: 'account',
      description: '部品の無い画面 — 本文だけ',
      props: { screen: 'account', hovered: null },
    },
  ],
  invariants: [
    {
      id: 'card-is-the-screen',
      description: '題はいま開いている画面のもの。触れても入れ替わらない',
      check: ({ root, props, contract }) => {
        const title = root.querySelector('h2')?.textContent ?? '';
        const expected = TEXTS.get(props.screen)?.title ?? '';
        if (contract.screen !== props.screen) return `契約 screen=${contract.screen}`;
        return title === expected || `題=${title}, 期待=${expected}`;
      },
    },
    {
      id: 'tiles-are-the-parts',
      description: '札は画面の部品の数だけ。それぞれ部品の題を持つ',
      check: ({ root, props }) => {
        const parts = screenParts(props.screen);
        const tiles = [...root.querySelectorAll<HTMLElement>('[data-part]')];
        if (tiles.length !== parts.length) return `札 ${tiles.length}（期待 ${parts.length}）`;
        // 書斎の札は 3D の注釈（JAR / ENTRIES / …）、他の画面は話題の題。
        const studyLabels: Record<string, string> = {
          jar: jaMessages.study.label_jar,
          notebook: jaMessages.study.label_journal,
          board: jaMessages.study.label_board,
          archive: jaMessages.study.label_archive,
          write: jaMessages.study.label_pen,
        };
        for (const tile of tiles) {
          const id = tile.getAttribute('data-part') ?? '';
          const expected =
            props.screen === 'study'
              ? (studyLabels[id] ?? '')
              : (TEXTS.get(parts.find((p) => p === id) ?? 'help')?.title ?? '');
          if (!tile.textContent?.includes(expected)) return `${id} の札に「${expected}」が無い`;
        }
        return true;
      },
    },
    {
      id: 'only-a-part-lights-up',
      description:
        '画面の中で触れたものが部品なら、その札だけが灯って説明が開く。部品でなければ何も起きない',
      check: ({ root, props, contract }) => {
        const parts = screenParts(props.screen);
        const expected =
          props.hovered !== null && parts.includes(props.hovered) ? props.hovered : 'none';
        if (contract.active !== expected) return `契約 active=${contract.active}, 期待=${expected}`;
        const explains = root.querySelector('[data-explains]')?.getAttribute('data-explains');
        if (explains !== (expected === 'none' ? 'screen' : expected)) return `説明=${explains}`;
        const body = root.querySelector('[data-explains]')?.textContent ?? '';
        const text = TEXTS.get(
          expected === 'none' ? props.screen : (props.hovered ?? props.screen),
        );
        return body.includes(text?.body ?? '') || '説明の本文が違う';
      },
    },
    {
      id: 'no-open-button',
      description: '「開く」のボタンを置かない（行き先へは一覧から）',
      check: ({ root }) => {
        const open = jaMessages.help.open_topic;
        return !(root.textContent ?? '').includes(open) || '「開く」がある';
      },
    },
  ],
});
