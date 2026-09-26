import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { aggregateOcrUsage, fetchOcrUsage } from '@/contexts/shared/infrastructure/ocr-usage-query';

const row = (over: Partial<Parameters<typeof aggregateOcrUsage>[0][number]>) => ({
  userId: 'u1',
  source: 'board' as const,
  inputTokens: 100,
  outputTokens: 10,
  succeeded: true,
  ...over,
});

describe('aggregateOcrUsage', () => {
  it('機能ごとに回数・成功失敗・トークンを数える', () => {
    const result = aggregateOcrUsage([
      row({}),
      row({ succeeded: false, inputTokens: null, outputTokens: null }),
      row({ source: 'entry', inputTokens: 1800, outputTokens: 40 }),
    ]);

    expect(result.board).toMatchObject({
      count: 2,
      succeededCount: 1,
      failedCount: 1,
      inputTokens: 100,
      outputTokens: 10,
    });
    expect(result.entry).toMatchObject({ count: 1, inputTokens: 1800, outputTokens: 40 });
  });

  it('ユーザー別は回数の多い順に並べる', () => {
    const result = aggregateOcrUsage([
      row({ userId: 'a' }),
      row({ userId: 'b' }),
      row({ userId: 'b' }),
    ]);

    expect(result.board.byUser.map((u) => [u.userId, u.count])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });

  it('使われなかった機能も 0 として持つ（欠けた機能を「読めなかった」と取り違えない）', () => {
    const result = aggregateOcrUsage([]);

    expect(result.board.count).toBe(0);
    expect(result.entry.count).toBe(0);
  });
});

function fakeSupabase(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
  // @type-assertion-allowed: テスト用に from() のクエリチェーンだけを持つ最小のスタブを SupabaseClient として渡す
  const client = { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient;
  return { client, chain };
}

const RANGE = { startIso: '2026-09-25T00:00:00.000Z', endIso: '2026-09-25T23:59:59.999Z' };

describe('fetchOcrUsage', () => {
  it('窓の中の記録を読んで集計する', async () => {
    const { client, chain } = fakeSupabase({
      data: [
        {
          user_id: 'u1',
          source: 'entry',
          input_tokens: 1800,
          output_tokens: 40,
          succeeded: true,
        },
      ],
      error: null,
    });

    const result = await fetchOcrUsage(client, RANGE);

    expect(chain.gte).toHaveBeenCalledWith('created_at', RANGE.startIso);
    expect(chain.lte).toHaveBeenCalledWith('created_at', RANGE.endIso);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.bySource.entry.count).toBe(1);
  });

  // migration 未適用だとテーブルが無い。それを「0 回」と出すと、使われていないように読める。
  it('読めなかったときは 0 回ではなくエラーとして返す', async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: 'relation "public.ocr_usage_events" does not exist' },
    });

    const result = await fetchOcrUsage(client, RANGE);

    expect(result).toEqual({
      kind: 'error',
      message: 'relation "public.ocr_usage_events" does not exist',
    });
  });
});
