import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * 認可境界の統合テスト — 「A の日記が B から見えない」を実 DB で確かめる。
 *
 * なぜ必要か:
 * `pnpm security:rls` はマイグレーション SQL の静的検査であり、
 *   - ポリシーが「書かれているか」は見られるが
 *   - その条件式が「実際に正しく絞れているか」は見られない
 * （例: user_id と書くべきところを id と書いた、参照するテーブルを間違えた）。
 * また、マイグレーションを経ずに作られたテーブルは静的検査の視界に入らない。
 *
 * ここでは本物の Postgres に対して、実在する 2 ユーザーの JWT で読みに行き、
 * 越境が 0 行であることを確認する。RLS の条件式そのものを検証する唯一の層。
 *
 * 実行方法:
 *   supabase start してから `pnpm --filter @oryzae/server test:integration`
 *   （CI では .github/workflows/e2e.yml の authz ジョブが実行する）
 * 環境が無い場合はスキップする（backend-testing-guide.md の方針）。
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// supabase/seed.sql と対応。ローカル使い捨てインスタンス専用のダミー資格情報。
const USER_A = { email: 'e2e@oryzae.test', password: 'e2e-password-1234' };
const USER_B = { email: 'e2e-b@oryzae.test', password: 'e2e-password-1234' };

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** anon key + そのユーザーの JWT を載せたクライアント。本番の authMiddleware と同じ構成。 */
async function signIn(creds: { email: string; password: string }) {
  const client = createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '');
  const { data, error } = await client.auth.signInWithPassword(creds);
  if (error || !data.session) {
    throw new Error(`サインインに失敗: ${creds.email} — ${error?.message ?? 'no session'}`);
  }
  return {
    userId: data.user.id,
    client: createClient(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '', {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    }),
  };
}

describe.skipIf(!canRun)('認可境界: 他ユーザーのデータが読めないこと', () => {
  let a: { userId: string; client: SupabaseClient };
  let b: { userId: string; client: SupabaseClient };
  const createdEntryIds: string[] = [];

  beforeAll(async () => {
    a = await signIn(USER_A);
    b = await signIn(USER_B);
    expect(a.userId).not.toBe(b.userId);
  });

  afterAll(async () => {
    // 後続テストに影響しないよう、作成者自身のクライアントで後片付けする。
    if (a && createdEntryIds.length > 0) {
      await a.client.from('entries').delete().in('id', createdEntryIds);
    }
  });

  describe('entries（日記本文そのもの）', () => {
    const secret = `A だけの秘密の記述 ${Date.now()}`;
    let entryId: string;

    beforeAll(async () => {
      const { data, error } = await a.client
        .from('entries')
        .insert({ user_id: a.userId, content: secret })
        .select('id')
        .single();
      if (error || !data) throw new Error(`A の entry 作成に失敗: ${error?.message}`);
      entryId = data.id;
      createdEntryIds.push(entryId);
    });

    it('A は自分の entry を読める（テスト自体が有効であることの確認）', async () => {
      const { data } = await a.client.from('entries').select('id, content').eq('id', entryId);
      expect(data).toHaveLength(1);
      expect(data?.[0]?.content).toBe(secret);
    });

    it('B は id を知っていても A の entry を読めない', async () => {
      const { data, error } = await b.client.from('entries').select('*').eq('id', entryId);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('B が全件取得しても A の entry は含まれない', async () => {
      const { data, error } = await b.client.from('entries').select('id');
      expect(error).toBeNull();
      expect((data ?? []).map((r) => r.id)).not.toContain(entryId);
    });

    it('B は A の entry を書き換えられない', async () => {
      const { data } = await b.client
        .from('entries')
        .update({ content: '改竄' })
        .eq('id', entryId)
        .select('id');
      // RLS 下では対象行が見えないため、更新は 0 行に終わる（エラーにはならない）
      expect(data ?? []).toEqual([]);

      const { data: after } = await a.client.from('entries').select('content').eq('id', entryId);
      expect(after?.[0]?.content).toBe(secret);
    });

    it('B は A の entry を削除できない', async () => {
      await b.client.from('entries').delete().eq('id', entryId);
      const { data: after } = await a.client.from('entries').select('id').eq('id', entryId);
      expect(after).toHaveLength(1);
    });

    it('B は user_id を A に詐称して書き込めない', async () => {
      const { error } = await b.client
        .from('entries')
        .insert({ user_id: a.userId, content: 'B が A になりすまして書いた' });
      expect(error).not.toBeNull();
    });
  });

  describe('profiles（Issue #503 の回帰テスト）', () => {
    it('B から見える profiles は自分の 1 件だけ', async () => {
      // 00009 の `FOR ALL USING (true)` が復活すると、ここで全ユーザー分が返る。
      const { data, error } = await b.client.from('profiles').select('id');
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data?.[0]?.id).toBe(b.userId);
    });

    it('B は A の profile を読めない', async () => {
      const { data } = await b.client.from('profiles').select('*').eq('id', a.userId);
      expect(data).toEqual([]);
    });

    it('B は A の profile を書き換えられない', async () => {
      await b.client.from('profiles').update({ nickname: '改竄' }).eq('id', a.userId);
      const { data } = await a.client.from('profiles').select('nickname').eq('id', a.userId);
      expect(data?.[0]?.nickname).not.toBe('改竄');
    });

    it('B は A の profile を削除できない', async () => {
      await b.client.from('profiles').delete().eq('id', a.userId);
      const { data } = await a.client.from('profiles').select('id').eq('id', a.userId);
      expect(data).toHaveLength(1);
    });
  });

  describe('ユーザー所有の全テーブルを横断して確認', () => {
    // 日記から派生するデータも本人以外に見えてはならない。
    // 新しいテーブルを足したらここにも追加すること。
    const USER_SCOPED_TABLES = [
      'entries',
      'entry_snapshots',
      'entry_question_links',
      'questions',
      'question_transactions',
      'board_cards',
      'board_snippets',
      'board_photos',
      'fermentation_results',
      'fermentation_scanned_entries',
      'user_fermentation_state',
      'analysis_worksheets',
      'extracted_snippets',
      'keywords',
      'letters',
      'profiles',
    ] as const;

    it.each(USER_SCOPED_TABLES)('%s から返る行は、すべて B 自身のものだけ', async (table) => {
      const { data, error } = await b.client.from(table).select('*');
      expect(error).toBeNull();

      for (const row of data ?? []) {
        // user_id を直接持つテーブルはそれで、profiles は id で本人性を判定する。
        const owner = table === 'profiles' ? row.id : row.user_id;

        // undefined を「判定不能だから見逃す」にしてはならない。
        // entry_snapshots / extracted_snippets / letters / keywords は user_id を持たず
        // 所有者を辿るサブクエリで守られており、しかも日記の逐語引用を保持する
        // 最も機微なテーブルである。見逃すと、サブクエリ条件が壊れてもテストは緑のまま通る。
        //
        // B は seed 直後で自分のデータを 1 件も持たないため、これらのテーブルから
        // 行が返ること自体が越境を意味する。owner が undefined のまま比較すれば
        // その場で落ちる（＝検出できる）ので、条件分岐を置かない。
        expect(owner).toBe(b.userId);
      }
    });
  });
});

describe.skipIf(canRun)('認可境界テスト（スキップ）', () => {
  it('SUPABASE_URL / SUPABASE_ANON_KEY が無いため実行できない', () => {
    // `supabase start` してから実行すること。CI では e2e.yml の authz ジョブが担当する。
    expect(canRun).toBe(false);
  });
});
