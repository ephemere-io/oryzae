/**
 * 書斎（3D ホーム）が読む唯一の読み取り専用ビューモデル。
 *
 * 仕様は `docs/oryzae-study/10-data-contract.md`、実装時の決着は同 `60-implementation-notes.md`。
 * 書斎は entry / jar / board の実データを抽象化して映すだけで、書き込みは一切しない。
 */

import type { InboxLetter } from '@/features/shared/fermentation/types';

/** 書斎から出ていける先。3D の物と SP のピルが共有する語彙。 */
export type StudyTarget =
  | { kind: 'jar' }
  /** 封（＝届いた手紙）。jar へ入り、手紙を開いた状態で見せる。 */
  | { kind: 'letter'; fermentationId: string; questionId: string }
  /** 当月の手帳。新規執筆へ。 */
  | { kind: 'journal-new' }
  /** 過去月の手帳・棚の背表紙。その月に絞った一覧へ。 */
  | { kind: 'journal-month'; month: string }
  /** 棚ごと（SP）。全月の一覧へ。 */
  | { kind: 'archive' }
  | { kind: 'board' };

/**
 * 瓶の見た目を決める発酵の状態。
 *
 * サーバーの `FermentationStatus`（pending / processing / completed / failed）とは別物で、
 * あちらは**発酵 1 件ごとの状態**。こちらは利用者から見た瓶の様子で、
 * `use-study-state` が合成する（60-implementation-notes.md §1）。
 */
export type StudyFermentationStatus = 'idle' | 'fermenting' | 'completed';

export interface StudyFermentation {
  /** 0..1。数値としては画面に出さない（見た目が語る）。 */
  readiness: number;
  status: StudyFermentationStatus;
  /** 届いた手紙。封をクリックしたときの行き先になる。 */
  letters: InboxLetter[];
}

/** 月ごとの手帳 1 冊。厚みは entryCount で決まる。 */
export interface Notebook {
  /** `YYYY-MM`（利用者のローカル暦月）。 */
  month: string;
  entryCount: number;
  /** 当月か。当月の手帳だけが新規執筆の入口になる。 */
  current: boolean;
}

/** 一覧オーバーレイの 1 行。本文全体は持たない。 */
export interface StudyEntry {
  id: string;
  createdAt: string;
  /** 本文の冒頭。 */
  excerpt: string;
  /** 本文の文字数。 */
  chars: number;
  linkedQuestions: { id: string; currentText: string | null }[];
  /** 問いにリンク済み＝漬けた。 */
  pickled: boolean;
}

/** 壁のボードに貼られた抽象カード 1 枚。 */
export interface StudyBoardCard {
  id: string;
  cardType: 'snippet' | 'photo';
  /** DOM と同じ world 座標（左上基準・y は下向き）。3D 側で符号を反転する。 */
  x: number;
  y: number;
  /** 度。DOM と同じ向き（3D 側で反転する）。 */
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  /** 抽象カードに引く罫線の本数。snippet の本文長から算出する。 */
  lines: number;
}

export interface StudyBoard {
  dateKey: string;
  viewType: 'daily' | 'weekly';
  cards: StudyBoardCard[];
}

/**
 * 書斎が読むものすべて。
 *
 * `10-data-contract.md` の StudyState から **profile と questions を落としてある**。
 * どちらも書斎の絵に出てこないためで、questions は `/questions/all` を 1 往復まるごと
 * 増やすだけになり、profile は `useAuth()` が全画面に配っているものの写しになる
 * （アバターを出すのは 3D ではなくフローティングのクローム側）。
 */
export interface StudyState {
  /** `YYYY-MM-DD`（ローカル暦日）。 */
  now: string;
  unreadCount: number;
  fermentation: StudyFermentation;
  /**
   * 瓶の中を漂う言葉。
   *
   * **直近に完了した発酵のキーワード**であって、いま漬けているものではない
   * （キーワードは発酵完了時に一括保存されるため、発酵中には 1 件も存在しない。
   * 60-implementation-notes.md §3）。
   */
  words: string[];
  notebooks: Notebook[];
  entries: StudyEntry[];
  /**
   * 生きている問い（一覧の絞り込みに出す）。
   *
   * 受信箱が `/questions` を引くついでに配ってもらう。ここで別に取ると同じものを
   * 2 回取りに行くことになる。
   */
  questions: { id: string; currentText: string | null }[];
  board: StudyBoard;
}
