import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { listActiveUserIds } from '@/contexts/fermentation/infrastructure/repositories/supabase-active-user-ids.js';

/** 本体と同じ値。ここがずれたらページ境界のテストが境界を突かなくなる。 */
const PAGE_SIZE = 1000;

interface RpcCall {
  after_user_id: string | null;
  page_size: number;
}

/**
 * `list_entry_author_ids` を再現する最小スタブ。
 *
 * 引数に **エントリー行**（= user_id の重複あり）を渡す。distinct を DB 側で
 * 解決するのがこの実装の要点なので、テストも「エントリーが何行あっても
 * ユーザー数しか返らない」という関係をそのまま再現する。
 *
 * `maxRows` は PostgREST 側の 1 レスポンス上限。page_size より小さく設定された
 * 場合を再現するために持たせている（本物と同じく、上限超過分は黙って返さない）。
 */
function createSupabase(
  entryUserIds: string[],
  options: { calls?: RpcCall[]; maxRows?: number } = {},
) {
  const distinctSorted = [...new Set(entryUserIds)].sort();
  const maxRows = options.maxRows ?? PAGE_SIZE;

  const client = {
    rpc(_name: string, args: RpcCall) {
      options.calls?.push(args);
      const after = args.after_user_id;
      const remaining = after === null ? distinctSorted : distinctSorted.filter((id) => id > after);
      const limit = Math.min(args.page_size, maxRows);
      return Promise.resolve({
        data: remaining.slice(0, limit).map((id) => ({ author_id: id })),
        error: null,
      });
    },
  };
  // @type-assertion-allowed: SupabaseClient 全体は実装できないため、この経路が使う rpc だけを持つスタブを渡す
  return client as unknown as SupabaseClient;
}

/** ゼロ埋め連番の user_id。文字列の昇順 = 生成順になるのでカーソルの検証が読みやすい。 */
function userIds(count: number, startIndex = 0): string[] {
  return Array.from({ length: count }, (_, i) => `u${String(startIndex + i).padStart(6, '0')}`);
}

describe('listActiveUserIds', () => {
  it('書いたことがあるユーザーを重複なく返す', async () => {
    const supabase = createSupabase(['u2', 'u1', 'u2', 'u3', 'u1']);

    expect(await listActiveUserIds(supabase)).toEqual(['u1', 'u2', 'u3']);
  });

  it('誰も書いていなければ空配列', async () => {
    expect(await listActiveUserIds(createSupabase([]))).toEqual([]);
  });

  it('エントリーが 1000 行を超えても全ユーザーが対象に入る（#621 の本体）', async () => {
    // 旧実装（entries を .limit(1000) で読んで JS で distinct）だと、先頭 1000 行に
    // 現れないユーザーが黙って落ちる。ここでは 3 人目のエントリーを 1000 行目より
    // 後ろに置いているので、打ち切られていれば 'u3' が消える。
    const supabase = createSupabase([
      ...Array.from({ length: 600 }, () => 'u1'),
      ...Array.from({ length: 600 }, () => 'u2'),
      'u3',
    ]);

    expect(await listActiveUserIds(supabase)).toEqual(['u1', 'u2', 'u3']);
  });

  it('エントリー数に関係なく 1 往復で済む（読む行数がユーザー数のオーダー）', async () => {
    const calls: RpcCall[] = [];
    const supabase = createSupabase(
      Array.from({ length: 50_000 }, (_, i) => `u${i % 3}`),
      { calls },
    );

    expect(await listActiveUserIds(supabase)).toEqual(['u0', 'u1', 'u2']);
    // 1 ページ目 + 「空ページが返るまで読む」の確認 1 回だけ。
    expect(calls).toEqual([
      { after_user_id: null, page_size: PAGE_SIZE },
      { after_user_id: 'u2', page_size: PAGE_SIZE },
    ]);
  });

  it('ユーザー数がページ境界ちょうどでも取りこぼさない', async () => {
    const ids = userIds(PAGE_SIZE);
    const calls: RpcCall[] = [];
    const supabase = createSupabase(ids, { calls });

    const result = await listActiveUserIds(supabase);

    expect(result).toHaveLength(PAGE_SIZE);
    expect(result).toEqual(ids);
    // 1 ページ目がちょうど埋まった時点で終わったと見なすと、境界ちょうどの
    // ケースは通ってしまう。空ページを確認する 2 往復目があることまで見る。
    expect(calls).toHaveLength(2);
  });

  it('ユーザー数がページ境界 + 1 でもカーソルで続きを読む', async () => {
    const ids = userIds(PAGE_SIZE + 1);
    const calls: RpcCall[] = [];
    const supabase = createSupabase(ids, { calls });

    expect(await listActiveUserIds(supabase)).toEqual(ids);
    expect(calls.map((c) => c.after_user_id)).toEqual([
      null,
      // 2 ページ目は直前ページの最大 user_id から続ける（offset ではない）。
      ids[PAGE_SIZE - 1],
      ids[PAGE_SIZE],
    ]);
  });

  it('PostgREST の上限が page_size より小さくても打ち切らない', async () => {
    // 「PAGE_SIZE 未満なら最終ページ」と判定する実装だと、ここで 10 人しか返らない。
    const ids = userIds(25);
    const supabase = createSupabase(ids, { maxRows: 10 });

    expect(await listActiveUserIds(supabase)).toEqual(ids);
  });

  it('RPC がエラーを返したら投げる（黙って空を返さない）', async () => {
    const client = {
      rpc: () => Promise.resolve({ data: null, error: { message: 'function does not exist' } }),
    };
    // @type-assertion-allowed: SupabaseClient 全体は実装できないため、この経路が使う rpc だけを持つスタブを渡す
    const supabase = client as unknown as SupabaseClient;

    await expect(listActiveUserIds(supabase)).rejects.toThrow('function does not exist');
  });

  it('data が配列でなければ投げる', async () => {
    const client = { rpc: () => Promise.resolve({ data: null, error: null }) };
    // @type-assertion-allowed: SupabaseClient 全体は実装できないため、この経路が使う rpc だけを持つスタブを渡す
    const supabase = client as unknown as SupabaseClient;

    await expect(listActiveUserIds(supabase)).rejects.toThrow('list_entry_author_ids');
  });

  it('ページ上限に達したら部分結果を返さず投げる', async () => {
    // カーソルを無視して常に満杯のページを返す壊れた応答。黙って返すと
    // 「発酵が届かないのにどの監視にも掛からない」状態になるので投げる。
    const client = {
      rpc: () =>
        Promise.resolve({
          data: userIds(PAGE_SIZE).map((id) => ({ author_id: id })),
          error: null,
        }),
    };
    // @type-assertion-allowed: SupabaseClient 全体は実装できないため、この経路が使う rpc だけを持つスタブを渡す
    const supabase = client as unknown as SupabaseClient;

    await expect(listActiveUserIds(supabase)).rejects.toThrow('ページ上限');
  });
});
