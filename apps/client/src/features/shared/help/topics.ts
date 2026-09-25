/**
 * 話題のカタログ（`docs/help-mode-guide.md`「話題」）。
 *
 * 順番がそのまま面に並ぶ順。**文面は持たない**（i18n `help.topics.<id>`）。ここにあるのは
 * 骨組み — どの節に入るか、どの線画を添えるか、「開く」でどこへ行くか。
 */

import type { HelpSection, HelpTopic, HelpTopicId } from './types';

export const HELP_SECTIONS: readonly HelpSection[] = ['start', 'room', 'screens', 'trouble'];

export const HELP_TOPICS: readonly HelpTopic[] = [
  // はじめに — 上から読めば一周する。一覧には並べない（書斎の 1 枚とチュートリアルが担う）。
  { id: 'study', section: 'start', illustration: 'room', href: '/' },
  { id: 'concept', section: 'start', illustration: 'room', href: '/' },
  { id: 'question', section: 'start', illustration: 'question', href: '/jar' },
  { id: 'write', section: 'start', illustration: 'pen', href: '/entries/new' },
  { id: 'pickle', section: 'start', illustration: 'jar', href: '/entries/new' },
  // 書斎のもの — 触れたときの説明の行き先。
  { id: 'jar', section: 'room', illustration: 'jar', href: '/jar' },
  { id: 'notebook', section: 'room', illustration: 'notebook', href: '/entries/new' },
  { id: 'board', section: 'room', illustration: 'board', href: '/board' },
  { id: 'archive', section: 'room', illustration: 'shelf', href: '/entries' },
  // 画面 — 物の先でできること。
  { id: 'letter', section: 'screens', illustration: 'letter', href: '/jar' },
  { id: 'snippet', section: 'screens', illustration: 'snippet', href: '/board' },
  { id: 'photo', section: 'screens', illustration: 'photo', href: '/board' },
  { id: 'list', section: 'screens', illustration: 'list', href: '/entries' },
  { id: 'questions', section: 'screens', illustration: 'timeline', href: '/questions' },
  { id: 'account', section: 'screens', illustration: 'person', href: '/account' },
  // 困ったとき。
  { id: 'support', section: 'trouble', illustration: 'memo', href: '/support', external: true },
  { id: 'help', section: 'trouble', illustration: 'search', href: null },
];

// 鍵は string。`isHelpTopicId` が知らない文字列で引く門なので、`HelpTopicId` で縛ると
// 引く前に型を合わせる（キャストする）ことになる。
const BY_ID: ReadonlyMap<string, HelpTopic> = new Map(HELP_TOPICS.map((t) => [t.id, t]));

export function helpTopic(id: HelpTopicId): HelpTopic {
  const topic = BY_ID.get(id);
  if (!topic) throw new Error(`unknown help topic: ${id}`);
  return topic;
}

/** 文字列が話題の識別子か。サーバーの返事や DOM 属性（`data-help`）を読むときの門。 */
export function isHelpTopicId(value: unknown): value is HelpTopicId {
  return typeof value === 'string' && BY_ID.has(value);
}

/**
 * いま開いている画面の話題。**何にも触れていないとき、面の頭に出す**。
 *
 * SP にはホバーが無いので、これが「いま触れているもの」の代わりになる。
 */
export function topicForScreen(pathname: string): HelpTopicId {
  if (pathname === '/') return 'study';
  if (pathname.startsWith('/jar')) return 'jar';
  if (pathname.startsWith('/board')) return 'board';
  if (pathname === '/entries') return 'list';
  if (pathname.startsWith('/entries')) return 'write';
  if (pathname.startsWith('/questions')) return 'questions';
  if (pathname.startsWith('/account')) return 'account';
  return 'study';
}

/**
 * 画面の中の部品（話題）。面の頭の 1 枚の見取り図に描かれ、画面の中で触れた物が灯る
 * （`help-screen-map.tsx` の図と 1:1）。無い画面は本文だけ。
 */
const SCREEN_PARTS: Partial<Record<HelpTopicId, readonly HelpTopicId[]>> = {
  study: ['board', 'jar', 'notebook', 'archive', 'write'],
  jar: ['question', 'letter', 'questions'],
  write: ['question', 'pickle', 'snippet'],
  board: ['snippet', 'photo'],
  list: ['notebook', 'archive'],
  questions: ['question'],
};

export function screenParts(screen: HelpTopicId): readonly HelpTopicId[] {
  return SCREEN_PARTS[screen] ?? [];
}

/**
 * 書斎の物に触れたときの話題。ラベルの種類（`LabelKind`）から引く。
 *
 * 鉛筆は「書く」。手帳は物としての手帳（当月＝書く、過去月＝一覧）ではなく**手帳という物**
 * の話題にする — 触れた瞬間に言うのは、その物が何かであって、押した先の画面ではない。
 */
export function topicForStudyLabel(
  label: 'jar' | 'journal' | 'board' | 'archive' | 'pen',
): HelpTopicId {
  switch (label) {
    case 'jar':
      return 'jar';
    case 'journal':
      return 'notebook';
    case 'board':
      return 'board';
    case 'archive':
      return 'archive';
    case 'pen':
      return 'write';
  }
}
