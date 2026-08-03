/** 問いドメインの共有型（端末非依存）。 */

/** 問い1件。一覧・タイムライン・SP の問い管理が共有する。 */
export interface QuestionItem {
  id: string;
  currentText: string | null;
  isArchived: boolean;
  isProposedByOryzae: boolean;
  isValidatedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * エントリ一覧の「問いで絞り込む」選択肢。
 *
 * Issue #490: もともと PC の EntryList が export し、page 経由で SP の一覧へ渡っていた
 * （pc → sp の依存を app でロンダリングしていた）。共有型としてここに置く。
 */
export interface FilterableQuestion {
  id: string;
  currentText: string;
}
