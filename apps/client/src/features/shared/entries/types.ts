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
