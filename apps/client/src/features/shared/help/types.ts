/**
 * ヘルプモードの型（`docs/help-mode-guide.md`）。
 *
 * ヘルプは**話題（topic）の一覧**でできている。画面の物・項目に触れると話題が 1 つ選ばれ、
 * 検索欄に書いた「したいこと」からも話題が 1 つ選ばれる。文面そのものは i18n
 * （`help.topics.<id>`）にあり、ここは骨組みだけを持つ。
 */

/** 話題の識別子。i18n の `help.topics.<id>` と 1:1。 */
export type HelpTopicId =
  | 'concept'
  | 'question'
  | 'write'
  | 'pickle'
  | 'jar'
  | 'notebook'
  | 'board'
  | 'archive'
  | 'letter'
  | 'snippet'
  | 'list'
  | 'questions'
  | 'account'
  | 'support'
  | 'help';

/**
 * 話題の束ね方。**読む順**でもある。
 *
 * - `start` … 初めて入った人が上から読めば一周する 4 つ（概念 → 問い → 書く → 漬ける）
 * - `room` … 書斎に置いてある物。触れたときの説明の主な行き先
 * - `screens` … 物の先にある画面でできること
 * - `trouble` … 困ったとき
 */
export type HelpSection = 'start' | 'room' | 'screens' | 'trouble';

/** 話題に添える線画の種類（`help-illustrations.tsx`）。 */
export type HelpIllustrationKind =
  | 'room'
  | 'question'
  | 'pen'
  | 'jar'
  | 'notebook'
  | 'board'
  | 'shelf'
  | 'letter'
  | 'snippet'
  | 'list'
  | 'timeline'
  | 'person'
  | 'memo'
  | 'search';

export interface HelpTopic {
  id: HelpTopicId;
  section: HelpSection;
  illustration: HelpIllustrationKind;
  /** 「開く」で行く先。アプリの外（公開サイト）なら `external`。無ければ null。 */
  href: string | null;
  external?: boolean;
}

/** 話題の 1 件ぶんの文面（i18n から組み立てる）。検索の材料でもある。 */
export interface HelpTopicText {
  id: HelpTopicId;
  title: string;
  /** 1 行で「何ができるか」。 */
  lead: string;
  body: string;
  /** 検索で拾う語。区切りは `,`。 */
  keywords: string[];
}

/** 検索の結果 1 件。`source` は誰が選んだか（手元の照合か、Jev か）。 */
export interface HelpMatch {
  id: HelpTopicId;
  score: number;
  source: 'local' | 'jev';
}

/** サーバー（`POST /api/v1/help/search`）の返事。 */
export interface HelpRouteResult {
  /** Jev が設定されているか。false なら手元の照合だけで動く。 */
  configured: boolean;
  topicId: HelpTopicId | null;
  /** 0〜1。低ければ採らない。 */
  confidence: number;
}

/** Jev（サーバー）の状態。`off` は未設定か api 無し。 */
export type HelpRemoteState = 'off' | 'idle' | 'asking' | 'answered';

/** `useHelpResolver` の入力。 */
export interface HelpResolverInput {
  /** いま開いている画面（pathname）。 */
  screen: string;
  locale: string;
  texts: readonly HelpTopicText[];
  /** 検索欄の中身。 */
  query: string;
  /** 触れている部品の名前（`data-help` を名乗っていないもの）。 */
  label: string | null;
  /** 名前の主が、先祖の `data-help` で名乗っている話題。名前で決まらなければこれ。 */
  labelFallback: HelpTopicId | null;
}

/** `useHelpResolver` の出力。 */
export interface HelpResolution {
  /** 検索欄の結果。Jev が選んだ話題があれば先頭に `source: 'jev'` で入る。 */
  matches: HelpMatch[];
  remote: HelpRemoteState;
  /** 触れている部品の話題。名前 → 先祖の名乗り → Jev の順で決める。 */
  labelTopic: HelpTopicId | null;
}
