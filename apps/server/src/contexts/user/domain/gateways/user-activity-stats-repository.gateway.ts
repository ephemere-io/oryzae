/**
 * Issue #316: ガイドモーダル表示判定に使う、user の "これまでの活動傾向" を
 * 1 user_id 引数で取り出すための port。
 *
 * 集計の元となるテーブル (entries / entry_question_links / questions / fermentation_results)
 * は entry / question / fermentation コンテキストの所有物だが、user 集計用 view として
 * ここ user 側に port を持たせ、infrastructure 実装が直接 Supabase に問い合わせる形を取る
 * (user-context-isolation ルールにより user → 他 context への参照は不可)。
 *
 * ヘルプの五歩（① 問いを立てる / ② エントリーを書く / ③ 問いを紐づける /
 * ④ 瓶に漬けて待つ / ⑤ 手紙を読む）の「済んだか」はここで揃える。
 */
export interface UserActivityStatsRepositoryGateway {
  /** 指定ユーザーが一度でも fermentation_enabled=true なエントリを持つか（五歩の ④） */
  hasPickled(userId: string): Promise<boolean>;
  /** 指定ユーザーが一度でも entry-question リンクを持つか（五歩の ③） */
  hasLinkedQuestion(userId: string): Promise<boolean>;
  /**
   * 指定ユーザーが問いを 1 件でも持つか（五歩の ①「問いを立てる」の判定）。
   * アーカイブ済みも数える — 立てたという事実は変わらない。
   */
  hasQuestion(userId: string): Promise<boolean>;
  /** 指定ユーザーがエントリを 1 件でも持つか（五歩の ②「エントリーを書く」の判定） */
  hasEntry(userId: string): Promise<boolean>;
  /**
   * 指定ユーザーが手紙を 1 通でも読んだか（五歩の ⑤「手紙を読む」の判定）。
   *
   * 既読は `fermentation_results.read_at` に残る。client が手紙を開くと
   * `POST /api/v1/fermentations/read` が問い単位で埋め、そのあと合図（`lib/activity` の
   * 'read'）でヘルプがこの旗を取り直す（順序は client 側 `use-unread-letters.ts` が守る）。
   * 届いただけで開いていない手紙は数えない。
   */
  hasReadLetter(userId: string): Promise<boolean>;
}
