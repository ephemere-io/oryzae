/** エントリドメインの共有型（端末非依存）。 */

/** 一覧の並び順。PC 一覧・SP 一覧の両方が使う。 */
export type EntryListOrder = 'newest' | 'oldest';

/** 書きかけの退避データ（localStorage に置き、再開時に復元する）。 */
export interface EntryDraft {
  /** 自動保存で既にエントリが作成済みならその id（再開時は同じエントリを更新＝重複作成を防ぐ）。 */
  entryId?: string;
  title: string;
  body: string;
  questionId: string | null;
  /** 最終編集時刻（epoch ms）。 */
  updatedAt: number;
  /** 最終編集時のローカル暦日（YYYY-MM-DD）。日付境界の判定に使う。 */
  dateKey: string;
}

/**
 * ある月に書かれた記録の件数。`month` は `YYYY-MM`（利用者のローカル暦月であって
 * UTC の月ではない）。書斎の手帳の厚みと、棚に並ぶ冊数を決める。
 */
export interface MonthlyEntryCount {
  month: string;
  count: number;
}

/** 一覧の行に紐づく問いの最小形（Issue #323 でサーバーが埋め込んで返す）。 */
export interface EntryLinkedQuestion {
  id: string;
  currentText: string | null;
}

/** 一覧が返す記録 1 件。本文まで含む（一覧は冒頭しか見せないが、行の描画側が決める）。 */
export interface EntryListItem {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  linkedQuestions: EntryLinkedQuestion[];
}
