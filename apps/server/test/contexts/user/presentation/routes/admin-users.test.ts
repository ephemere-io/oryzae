import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminUsers } from '@/contexts/user/presentation/routes/admin-users.js';

/**
 * 一覧の集計は id のカーソルでページングする。ここで検証したいのは:
 *  - 1000 行を超えても全件数えられる（ページングしないと PostgREST の既定上限で
 *    静かに打ち切られ、件数が実態より少なく出る）
 *  - ページ境界が安定するよう `.order('id')` を必ず付けている
 *  - カーソルに使う `id` が select 句に含まれている
 *
 * スタブは **select 句を尊重する**（要求されていない列は返さない）。ここを無視すると、
 * 「id を select し忘れてもテストは通る」という抜けができる（実際にそれで
 * `columns.includes('id')` の部分一致バグを見逃した）。
 */
interface TableRows {
  entries: Record<string, unknown>[];
  questions: Record<string, unknown>[];
  fermentation_results: Record<string, unknown>[];
}

const orderCalls: { table: string; column: string }[] = [];

function createSupabase(tables: TableRows, users: { id: string; email: string }[]): SupabaseClient {
  const stub = {
    auth: {
      admin: {
        listUsers: () =>
          Promise.resolve({
            data: {
              users: users.map((u) => ({
                id: u.id,
                email: u.email,
                created_at: '2026-01-01T00:00:00Z',
                last_sign_in_at: null,
              })),
            },
          }),
      },
    },
    // ページングは id のカーソル方式（offset ではない）。gt('id', cursor) 以降を返す。
    from: (table: keyof TableRows) => ({
      select: (columns: string) => {
        // select 句に無い列は返さない。ここを緩くすると「id を select し忘れても
        // テストが通る」抜けができる（実際に部分一致バグを見逃した）。
        const requested = columns.split(',').map((c) => c.trim());
        const project = (row: Record<string, unknown>): Record<string, unknown> => {
          const out: Record<string, unknown> = {};
          for (const name of requested) {
            if (name in row) out[name] = row[name];
          }
          return out;
        };

        const build = (cursor: string | null) => ({
          gt: (_col: string, value: string) => build(value),
          order: (column: string) => {
            orderCalls.push({ table, column });
            return {
              limit: (n: number) => {
                const all = tables[table];
                const start = cursor ? all.findIndex((r) => r.id === cursor) + 1 : 0;
                return Promise.resolve({
                  data: all.slice(start, start + n).map(project),
                  error: null,
                });
              },
            };
          },
        });

        return { in: () => build(null) };
      },
    }),
  };
  // @type-assertion-allowed: SupabaseClient は多数のメソッドを持つが、このルートが触るのは
  // auth.admin.listUsers と from().select().in().order().limit() のみ。最小限だけスタブする。
  return stub as unknown as SupabaseClient;
}

function createApp(supabase: SupabaseClient) {
  return new Hono()
    .use('*', async (c, next) => {
      c.set('adminSupabase', supabase);
      await next();
    })
    .route('/users', adminUsers);
}

describe('adminUsers GET /', () => {
  beforeEach(() => {
    orderCalls.length = 0;
    vi.clearAllMocks();
  });

  it('1000 行を超えるエントリーも全件数える（既定上限で打ち切らない）', async () => {
    // id はカーソルに使われるので必ず一意にする。
    const entries = Array.from({ length: 2500 }, (_, i) => ({
      id: `e${String(i).padStart(5, '0')}`,
      user_id: 'u1',
      created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    }));

    const res = await createApp(
      createSupabase({ entries, questions: [], fermentation_results: [] }, [
        { id: 'u1', email: 'a@test.com' },
      ]),
    ).request('/users');

    const body = await res.json();
    expect(body.users[0].entryCount).toBe(2500);
  });

  it('ページ境界を安定させるため id で並べ、カーソルで進む', async () => {
    await createApp(
      createSupabase({ entries: [], questions: [], fermentation_results: [] }, [
        { id: 'u1', email: 'a@test.com' },
      ]),
    ).request('/users');

    // 3 テーブルすべてが order('id') を通っていること。
    expect(orderCalls.map((c) => c.table).sort()).toEqual([
      'entries',
      'fermentation_results',
      'questions',
    ]);
    expect(orderCalls.every((c) => c.column === 'id')).toBe(true);
  });

  it('最終活動日時は最後に書いたエントリーの時刻を返す', async () => {
    const entries = [
      { id: 'e1', user_id: 'u1', created_at: '2026-02-01T00:00:00Z' },
      { id: 'e2', user_id: 'u1', created_at: '2026-05-01T00:00:00Z' },
      { id: 'e3', user_id: 'u1', created_at: '2026-03-01T00:00:00Z' },
    ];

    const res = await createApp(
      createSupabase({ entries, questions: [], fermentation_results: [] }, [
        { id: 'u1', email: 'a@test.com' },
      ]),
    ).request('/users');

    const body = await res.json();
    expect(body.users[0].lastActivityAt).toBe('2026-05-01T00:00:00Z');
  });

  it('一度も書いていないユーザーの最終活動日時は null', async () => {
    const res = await createApp(
      createSupabase({ entries: [], questions: [], fermentation_results: [] }, [
        { id: 'u1', email: 'a@test.com' },
      ]),
    ).request('/users');

    const body = await res.json();
    expect(body.users[0].lastActivityAt).toBeNull();
  });

  it('発酵の成否を数える', async () => {
    const fermentations = [
      { id: 'f1', user_id: 'u1', status: 'completed' },
      { id: 'f2', user_id: 'u1', status: 'failed' },
      { id: 'f3', user_id: 'u1', status: 'completed' },
    ];

    const res = await createApp(
      createSupabase({ entries: [], questions: [], fermentation_results: fermentations }, [
        { id: 'u1', email: 'a@test.com' },
      ]),
    ).request('/users');

    const body = await res.json();
    expect(body.users[0]).toMatchObject({
      fermentationTotal: 3,
      fermentationCompleted: 2,
      fermentationFailed: 1,
    });
  });
});
