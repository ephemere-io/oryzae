import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseUserActivityStatsRepository } from '@/contexts/user/infrastructure/repositories/supabase-user-activity-stats.repository';

/**
 * `from().select().eq().not().limit()` の鎖を、最後に決めた返事で返す stub。
 * 途中の呼び出しは全部自分を返す。
 */
function stubClient(reply: { data: unknown[] | null; error: unknown }): SupabaseClient {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.not = self;
  chain.is = self;
  chain.limit = () => Promise.resolve(reply);
  const client: unknown = { from: () => chain };
  if (typeof client !== 'object' || client === null) throw new Error('stub');
  // SupabaseClient の形を全部は満たさない。使うのは from() の鎖だけ。
  return Object.assign(Object.create(null), client);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SupabaseUserActivityStatsRepository.hasReadLetter', () => {
  it('read_at が入った行があれば true', async () => {
    const repo = new SupabaseUserActivityStatsRepository(
      stubClient({ data: [{ id: 'r1' }], error: null }),
    );
    expect(await repo.hasReadLetter('u1')).toBe(true);
  });

  it('無ければ false', async () => {
    const repo = new SupabaseUserActivityStatsRepository(stubClient({ data: [], error: null }));
    expect(await repo.hasReadLetter('u1')).toBe(false);
  });

  it('read_at のカラムがまだ無い（migration 00027 未適用）なら、投げずに false に倒して warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const repo = new SupabaseUserActivityStatsRepository(
      stubClient({
        data: null,
        error: { code: '42703', message: 'column fermentation_results.read_at does not exist' },
      }),
    );
    expect(await repo.hasReadLetter('u1')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('それ以外の失敗はそのまま投げる', async () => {
    const repo = new SupabaseUserActivityStatsRepository(
      stubClient({ data: null, error: { code: '42501', message: 'permission denied' } }),
    );
    await expect(repo.hasReadLetter('u1')).rejects.toMatchObject({ code: '42501' });
  });
});
