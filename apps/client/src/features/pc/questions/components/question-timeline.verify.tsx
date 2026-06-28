/**
 * QuestionTimeline の検証スペック（A 移植）。
 * 問いの変遷を日付グループ + イベント行として描画する純表示部品。
 * i18n（questions.timeline / questions.event）は withVerifyProviders が供給。
 *
 * 空配列でも内容（empty メッセージ）を描画するため、ルートに必ず
 * data-verify-unit="QuestionTimeline" が付き契約が読める（delete-modal の
 * open=false null 描画とは異なり、空状態も fixture にできる）。
 * 唯一の実ロジックである groupByDate（updatedAt 降順 + 日付グルーピング）を
 * probe で検証する。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { QuestionTimeline } from './question-timeline';

interface QuestionItem {
  id: string;
  currentText: string | null;
  isArchived: boolean;
  isProposedByOryzae: boolean;
  isValidatedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  questions: QuestionItem[];
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

const noop = () => {};

const handlers = {
  onArchive: noop,
  onUnarchive: noop,
  onAccept: noop,
  onReject: noop,
};

const active: QuestionItem = {
  id: 'q-active',
  currentText: '今日いちばん心が動いた瞬間は？',
  isArchived: false,
  isProposedByOryzae: false,
  isValidatedByUser: true,
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T10:00:00.000Z',
};

const proposed: QuestionItem = {
  id: 'q-proposed',
  currentText: 'その選択を後押ししたものは何だった？',
  isArchived: false,
  isProposedByOryzae: true,
  isValidatedByUser: false,
  createdAt: '2026-06-25T09:00:00.000Z',
  updatedAt: '2026-06-25T09:00:00.000Z',
};

const archived: QuestionItem = {
  id: 'q-archived',
  currentText: '昔よく書いていた問い',
  isArchived: true,
  isProposedByOryzae: false,
  isValidatedByUser: true,
  createdAt: '2026-06-18T08:00:00.000Z',
  updatedAt: '2026-06-18T08:00:00.000Z',
};

registerUnit<Props>({
  id: 'QuestionTimeline',
  title: 'QuestionTimeline',
  description: '問いの変遷タイムライン（日付グループ + 種別ごとのイベント行）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<QuestionTimeline {...props} />),
  fixtures: [
    {
      id: 'empty',
      description: '問いが 0 件（empty メッセージのみ）',
      props: { questions: [], ...handlers },
    },
    {
      id: 'populated',
      description: 'active / proposed / archived が混在する',
      props: { questions: [active, proposed, archived], ...handlers },
    },
    {
      id: 'newest-first',
      probe: true,
      description: 'Probe: groupByDate が updatedAt 降順で並べる（新しい問いが先頭に来る）',
      props: { questions: [archived, active, proposed], ...handlers },
    },
    {
      id: 'null-text',
      probe: true,
      description: 'Probe: currentText=null でも ?? "" でフォールバックし描画が崩れない',
      props: {
        questions: [{ ...active, id: 'q-null', currentText: null }],
        ...handlers,
      },
    },
  ],
  invariants: [
    {
      id: 'empty-contract-matches-props',
      description: 'data-verify-empty が「questions が空か」と一致する',
      check: ({ contract, props }) =>
        contract.empty === String(props.questions.length === 0) ||
        `empty 契約不一致: questions=${props.questions.length} 件 → contract.empty=${contract.empty}`,
    },
    {
      id: 'count-contract-matches-props',
      description: 'data-verify-count が props.questions.length と一致する',
      check: ({ contract, props }) =>
        contract.count === String(props.questions.length) ||
        `count 契約不一致: props=${props.questions.length} → contract.count=${contract.count}`,
    },
    {
      id: 'event-rows-match-question-count',
      description: '描画される QuestionTimelineEvent の数が questions の件数と一致する',
      check: ({ root, props }) => {
        const events = root.querySelectorAll('[data-verify-unit="QuestionTimelineEvent"]');
        return (
          events.length === props.questions.length ||
          `イベント行数不一致: rendered=${events.length}, questions=${props.questions.length}`
        );
      },
    },
    {
      id: 'newest-first-order',
      description: 'updatedAt が新しい問いほど DOM 上で先に描画される',
      onlyFixtures: ['newest-first'],
      check: ({ root, props }) => {
        const events = Array.from(
          root.querySelectorAll('[data-verify-unit="QuestionTimelineEvent"]'),
        );
        const sorted = [...props.questions].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        const expectedFirst = sorted[0]?.currentText ?? '';
        const firstText = events[0]?.textContent ?? '';
        return (
          firstText.includes(expectedFirst) ||
          `先頭イベントが updatedAt 最新でない: 期待="${expectedFirst}", 実際="${firstText}"`
        );
      },
    },
  ],
});
