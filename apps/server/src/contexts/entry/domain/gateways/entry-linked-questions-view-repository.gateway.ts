/**
 * Issue #323: エントリ一覧 (`GET /api/v1/entries`) に「そのエントリに紐づく
 * 問いの全文」を併載するための read-only port。
 *
 * 集計の元データ (entry_question_links / questions / question_transactions)
 * は entry と question 両コンテキストにまたがるが、`entry-context-isolation`
 * dep-cruise rule により entry 側から question 側のリポジトリは参照できない。
 * `user` コンテキストの `UserActivityStatsRepository` と同じ判断で、entry
 * 側に read-only な view port を持たせ、infrastructure 実装が直接 Supabase
 * に問い合わせる。
 */
export interface LinkedQuestionView {
  id: string;
  /** 最新の validated transaction のテキスト。未発行なら null */
  currentText: string | null;
}

export interface EntryLinkedQuestionsViewRepositoryGateway {
  /**
   * 与えられた entry ID 群に対し、各エントリに紐づく問い一覧を返す。
   * 結果は entry ID をキーとした Record で、紐づきが無いエントリは欠落する
   * (呼び出し側で `?? []` フォールバックを取る)。
   *
   * 実装は N+1 を起こさず O(2-3) クエリで完結すること。
   */
  listByEntryIds(entryIds: string[]): Promise<Record<string, LinkedQuestionView[]>>;
}
