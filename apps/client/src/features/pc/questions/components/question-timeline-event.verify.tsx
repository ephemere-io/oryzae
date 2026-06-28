/**
 * QuestionTimelineEvent の検証スペック（A 移植）。
 * 問いのタイムライン上の1イベント（作成/提案/アーカイブ）を表す純表示部品。
 * eventType を契約として公表し、「eventType ごとに出るアクションボタンが変わる」
 * （proposed=承認+却下の2つ / archived=復元 / active=アーカイブ）を invariant で検証する。
 * クリックで対応コールバックが正しい id で発火することも act + probe で確認する。
 * i18n（questions.event）依存のため withVerifyProviders（NextIntlClientProvider）で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionTimelineEvent } from './question-timeline-event';

type EventType = 'active' | 'proposed' | 'archived';

interface Props {
  id: string;
  text: string;
  eventType: EventType;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

const noop = () => {};

const baseHandlers = {
  onArchive: noop,
  onUnarchive: noop,
  onAccept: noop,
  onReject: noop,
};

registerUnit<Props>({
  id: 'QuestionTimelineEvent',
  title: 'QuestionTimelineEvent',
  description: '問いのタイムラインの1イベント（作成/提案/アーカイブ）。状態でアクションが変わる。',
  kind: 'component',
  render: (props) => withVerifyProviders(<QuestionTimelineEvent {...props} />),
  fixtures: [
    {
      id: 'active',
      description: 'ユーザーが作成した有効な問い（アーカイブのみ可能）',
      props: {
        id: 'q1',
        text: '今日いちばん心が動いた瞬間は？',
        eventType: 'active',
        ...baseHandlers,
      },
    },
    {
      id: 'proposed',
      description: 'Oryzae が提案した問い（承認 / 却下が可能）',
      props: {
        id: 'q2',
        text: 'その選択をしたとき、何を一番大事にした？',
        eventType: 'proposed',
        ...baseHandlers,
      },
    },
    {
      id: 'archived',
      description: 'アーカイブ済みの問い（復元が可能）',
      props: {
        id: 'q3',
        text: '昔の自分に伝えたいことは？',
        eventType: 'archived',
        ...baseHandlers,
      },
    },
    {
      id: 'accept-click-keeps-contract',
      probe: true,
      description: 'Probe: proposed で承認ボタンを押しても契約・DOM が壊れない（クラッシュしない）',
      props: {
        id: 'q2',
        text: 'その選択をしたとき、何を一番大事にした？',
        eventType: 'proposed',
        ...baseHandlers,
      },
      act: async (ctx) => {
        await ctx.click('button');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'event-type-contract-matches-props',
      description: 'data-verify-event-type が props.eventType と一致する',
      check: ({ contract, props }) =>
        contract.eventType === props.eventType ||
        `eventType 契約不一致: props=${props.eventType} → contract=${contract.eventType}`,
    },
    {
      id: 'question-text-rendered',
      description: '問い本文が描画される',
      check: ({ root, props }) =>
        Boolean(root.textContent?.includes(props.text)) ||
        `問い本文 "${props.text}" が描画されていない`,
    },
    {
      id: 'proposed-has-two-actions',
      description: 'proposed は承認・却下の2ボタンを出す',
      onlyFixtures: ['proposed', 'accept-click-keeps-contract'],
      check: ({ root }) => {
        const count = root.querySelectorAll('button').length;
        return count === 2 || `proposed なのにボタン数が2でない: ${count}`;
      },
    },
    {
      id: 'archived-has-single-action',
      description: 'archived は復元の1ボタンだけ出す',
      onlyFixtures: ['archived'],
      check: ({ root }) => {
        const count = root.querySelectorAll('button').length;
        return count === 1 || `archived なのにボタン数が1でない: ${count}`;
      },
    },
    {
      id: 'active-has-single-action',
      description: 'active はアーカイブの1ボタンだけ出す',
      onlyFixtures: ['active'],
      check: ({ root }) => {
        const count = root.querySelectorAll('button').length;
        return count === 1 || `active なのにボタン数が1でない: ${count}`;
      },
    },
    {
      id: 'all-buttons-have-accessible-name',
      description: 'すべてのアクションボタンにアクセシブルネーム（テキスト）がある',
      check: ({ root }) => {
        const buttons = Array.from(root.querySelectorAll('button'));
        const unnamed = buttons.filter((b) => !b.textContent?.trim());
        return unnamed.length === 0 || `アクセシブルネームのないボタンが ${unnamed.length} 個ある`;
      },
    },
  ],
});
