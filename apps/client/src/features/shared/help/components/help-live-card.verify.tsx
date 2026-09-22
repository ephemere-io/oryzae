/**
 * HelpLiveCard の検証スペック。
 *
 * 見張るのは「**名前と説明だけ**」であること — 見出しの見出し（「いま触れているもの」）も、
 * 押すもの（「開く」）も、使い方の説明（「カーソルを載せると…」）も置かない。触れると
 * 変わる、それ自体が説明。
 */

import { registerUnit } from '@oryzae/verify';
import jaMessages from '@/i18n/messages/ja.json';
import { helpTextsFrom } from '../hooks/use-help-texts';
import { helpTopic } from '../topics';
import type { HelpTopicId } from '../types';
import { HelpLiveCard } from './help-live-card';

interface Props {
  topic: HelpTopicId;
  following: boolean;
}

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
  id: 'HelpLiveCard',
  title: 'HelpLiveCard',
  description: 'ヘルプの面の頭。触れているものの名前と説明が、ここで切り替わる',
  kind: 'component',
  render: (props) => (
    <div className="w-[336px] p-4" style={{ background: 'var(--surface-sunken)' }}>
      <HelpLiveCard
        topic={helpTopic(props.topic)}
        text={textOf(props.topic)}
        following={props.following}
      />
    </div>
  ),
  fixtures: [
    {
      id: 'screen',
      description: '何にも触れていない（いま開いている画面）',
      props: { topic: 'board', following: false },
    },
    { id: 'hover-jar', description: '瓶に触れている', props: { topic: 'jar', following: true } },
    {
      id: 'external-topic',
      probe: true,
      description: 'Probe: 外へ出る話題でも、ここには押すものを置かない',
      props: { topic: 'support', following: true },
    },
  ],
  invariants: [
    {
      id: 'no-controls',
      description: '押すものが無い（ボタンへ向かう途中で中身が変わり、押せない）',
      check: ({ root }) =>
        root.querySelector('button, a') === null || '面の頭に押すものが残っている',
    },
    {
      id: 'no-meta-text',
      description: '見出しの見出しや使い方の説明を書かない（触れると変わる、それ自体が説明）',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        const meta = ['いま触れている', 'いま開いている', 'カーソル'].filter((w) =>
          text.includes(w),
        );
        return meta.length === 0 || `説明の説明が残っている: ${meta.join(', ')}`;
      },
    },
    {
      id: 'shows-name-and-body',
      description: '名前・一言・本文がそのまま出る',
      check: ({ root, props }) => {
        const t = textOf(props.topic);
        const text = root.textContent ?? '';
        return (
          (text.includes(t.title) && text.includes(t.lead) && text.includes(t.body)) ||
          '名前・一言・本文のどれかが出ていない'
        );
      },
    },
    {
      id: 'following-contract',
      description: 'following 契約が props と一致する',
      check: ({ contract, props }) =>
        contract.following === String(props.following) || `following=${contract.following}`,
    },
  ],
});
