/**
 * Issue #316: ガイドモーダル表示判定に使う、user の "これまでの活動傾向" を
 * 1 user_id 引数で取り出すための port。
 *
 * 集計の元となるテーブル (entries / entry_question_links) は entry / question
 * コンテキストの所有物だが、user 集計用 view としてここ user 側に port を
 * 持たせ、infrastructure 実装が直接 Supabase に問い合わせる形を取る
 * (user-context-isolation ルールにより user → 他 context への参照は不可)。
 */
export interface UserActivityStatsRepositoryGateway {
  /** 指定ユーザーが一度でも fermentation_enabled=true なエントリを持つか */
  hasPickled(userId: string): Promise<boolean>;
  /** 指定ユーザーが一度でも entry-question リンクを持つか */
  hasLinkedQuestion(userId: string): Promise<boolean>;
}
