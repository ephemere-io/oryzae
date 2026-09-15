import type { SupabaseClient } from '@supabase/supabase-js';
import { readString, toRecordArray } from '../../../shared/infrastructure/row.js';

/**
 * 00024 で追加した DB 関数。entries の user_id を **DB 側で** distinct にして返す。
 * 返る行数がユーザー数のオーダーになるので、エントリーが何万行に増えても
 * 1 レスポンス上限に掛からない（issue #621）。
 */
const RPC_NAME = 'list_entry_author_ids';

/** 1 ページで受け取るユーザー数。PostgREST の 1 レスポンス上限と同値。 */
const PAGE_SIZE = 1000;

/** 辿るページ数の上限。1000 人 × 50 = 5 万人。到達したら黙って返さず投げる。 */
const MAX_PAGES = 50;

/**
 * 発酵の対象ユーザー（＝これまでに 1 度でもエントリーを書いた人）の user_id を全件返す。
 *
 * **service role のクライアントで呼ぶこと。** 関数は security invoker なので、
 * ユーザー JWT のクライアントで呼ぶと RLS が効いて自分の user_id しか返らない。
 *
 * 以前は cron と admin が別々に `entries` を `.limit(1000)` で読んで JS 側で
 * distinct を取っていた。1000 はエントリー**行数**の上限なので、総数が超えると
 * 一部ユーザーがエラーも出さずに発酵対象から消えた（#621）。この関数はその 2 つの
 * コピーを 1 箇所に集約したもの。
 *
 * ページングは user_id のカーソルで進める。ユーザー数が 1 レスポンス上限を
 * 超えても辿り切れるようにするためで、distinct の結果は昇順なので
 * `user_id > 直前ページの最大値` で続きが取れる。
 *
 * **打ち切りは「空ページが返るまで読む」で判定する。**「PAGE_SIZE 未満なら
 * 最終ページ」と見なす実装だと、PostgREST 側の上限が PAGE_SIZE より小さく
 * 設定された瞬間に 1 ページ目で終わったと誤判定し、この関数が防ぐはずの
 * 「エラーにならないのに対象が少ない」状態を自分で作ってしまう。
 *
 * 上限に達したら**投げる**。黙って部分結果を返すと発酵が届かないユーザーが
 * 出るうえ、cron の失敗通知にも引っかからない（「失敗」ではなく「そもそも
 * 対象に入らない」ので、どの監視にも掛からないのが #621 の質の悪さだった）。
 */
export async function listActiveUserIds(supabase: SupabaseClient): Promise<string[]> {
  const userIds: string[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase.rpc(RPC_NAME, {
      after_user_id: cursor,
      page_size: PAGE_SIZE,
    });
    if (error) throw new Error(`${RPC_NAME} failed: ${error.message}`);

    const rows = toRecordArray(data, RPC_NAME);
    if (rows.length === 0) return userIds;

    for (const row of rows) {
      const userId = readString(row, 'author_id');
      userIds.push(userId);
      cursor = userId;
    }
  }

  throw new Error(
    `${RPC_NAME}: ページ上限 ${MAX_PAGES} に達しました（${userIds.length} 件読み込み済み）。` +
      '対象ユーザーを取りこぼすため中断します。',
  );
}
