import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateCost,
  aggregateCostByDay,
  type FermentationCostRow,
  fetchFermentationCostRows,
  resolveUserEmails,
} from '@/contexts/shared/infrastructure/fermentation-cost-query.js';

// claude-pricing: input $3 / output $15 per 1M tokens
const COST_PER_INPUT = 3 / 1_000_000;
const COST_PER_OUTPUT = 15 / 1_000_000;

function row(overrides: Partial<FermentationCostRow> = {}): FermentationCostRow {
  return {
    userId: 'user-1',
    status: 'completed',
    inputTokens: 1000,
    outputTokens: 500,
    createdAt: '2026-08-08T18:05:00.000Z',
    ...overrides,
  };
}

/**
 * Supabase の PostgREST ビルダーを最小限だけ模したスタブ。
 * range(offset, end) ごとに pages[] から1ページ返す。
 */
function createSupabaseStub(pages: Record<string, unknown>[][]) {
  const rangeCalls: [number, number][] = [];
  const builder = {
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      rangeCalls.push([from, to]);
      const page = pages.shift() ?? [];
      return Promise.resolve({ data: page, error: null });
    },
  };
  const client = { from: () => ({ select: () => builder }) };
  // @type-assertion-allowed: テスト用の最小 Supabase スタブ。実際に使うのは from().select() 以降だけ
  return { client: client as unknown as SupabaseClient, rangeCalls };
}

describe('fetchFermentationCostRows', () => {
  it('pages through results until a short page is returned', async () => {
    // 旧実装は .range() 無しで Supabase 既定の 1000 行に暗黙に打ち切られていた。
    const firstPage = Array.from({ length: 1000 }, () => ({
      user_id: 'user-1',
      status: 'completed',
      input_tokens: 10,
      output_tokens: 5,
      created_at: '2026-08-08T18:00:00.000Z',
    }));
    const secondPage = [
      {
        user_id: 'user-2',
        status: 'completed',
        input_tokens: 20,
        output_tokens: 10,
        created_at: '2026-08-08T18:01:00.000Z',
      },
    ];
    const { client, rangeCalls } = createSupabaseStub([firstPage, secondPage]);

    const result = await fetchFermentationCostRows(client);

    expect(result.rows).toHaveLength(1001);
    expect(result.truncated).toBe(false);
    expect(rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('stops on the first short page without extra requests', async () => {
    const { client, rangeCalls } = createSupabaseStub([
      [
        {
          user_id: 'user-1',
          status: 'completed',
          input_tokens: 1,
          output_tokens: 1,
          created_at: '2026-08-08T18:00:00.000Z',
        },
      ],
    ]);

    const result = await fetchFermentationCostRows(client);

    expect(result.rows).toHaveLength(1);
    expect(rangeCalls).toHaveLength(1);
  });

  it('normalises missing tokens to null rather than 0', async () => {
    const { client } = createSupabaseStub([
      [
        {
          user_id: 'user-1',
          status: 'failed',
          input_tokens: null,
          output_tokens: null,
          created_at: '2026-08-08T18:00:00.000Z',
        },
      ],
    ]);

    const result = await fetchFermentationCostRows(client);

    expect(result.rows[0].inputTokens).toBeNull();
    expect(result.rows[0].outputTokens).toBeNull();
  });

  it('throws with the Supabase error message', async () => {
    const builder = {
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      order: () => builder,
      range: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }),
    };
    // @type-assertion-allowed: テスト用の最小 Supabase スタブ
    const client = { from: () => ({ select: () => builder }) } as unknown as SupabaseClient;

    await expect(fetchFermentationCostRows(client)).rejects.toThrow('permission denied');
  });
});

describe('aggregateCost', () => {
  it('computes cost from stored tokens', () => {
    const result = aggregateCost([row({ inputTokens: 1000, outputTokens: 500 })]);

    expect(result.estimatedCostUsd).toBeCloseTo(1000 * COST_PER_INPUT + 500 * COST_PER_OUTPUT, 10);
    expect(result.inputTokens).toBe(1000);
    expect(result.outputTokens).toBe(500);
    expect(result.fermentationCount).toBe(1);
  });

  it('counts rows without tokens as untracked instead of silently dropping them', () => {
    const result = aggregateCost([
      row({ inputTokens: 1000, outputTokens: 500 }),
      row({ inputTokens: null, outputTokens: null, status: 'failed' }),
    ]);

    expect(result.fermentationCount).toBe(2);
    expect(result.untrackedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.completedCount).toBe(1);
  });

  it('breaks cost down per user, sorted by cost descending', () => {
    const result = aggregateCost([
      row({ userId: 'a', inputTokens: 1000, outputTokens: 0 }),
      row({ userId: 'b', inputTokens: 5000, outputTokens: 0 }),
      row({ userId: 'a', inputTokens: 1000, outputTokens: 0 }),
    ]);

    expect(result.byUser).toHaveLength(2);
    expect(result.byUser[0].userId).toBe('b');
    expect(result.byUser[0].fermentationCount).toBe(1);
    expect(result.byUser[1].userId).toBe('a');
    expect(result.byUser[1].fermentationCount).toBe(2);
    expect(result.byUser[1].inputTokens).toBe(2000);
  });

  it('returns zeros for an empty set', () => {
    const result = aggregateCost([]);
    expect(result.estimatedCostUsd).toBe(0);
    expect(result.fermentationCount).toBe(0);
    expect(result.byUser).toEqual([]);
  });
});

describe('aggregateCostByDay', () => {
  it('groups by the caller-supplied date key and sorts ascending', () => {
    const result = aggregateCostByDay(
      [
        row({ createdAt: '2026-08-08T18:00:00.000Z', inputTokens: 1000, outputTokens: 0 }),
        row({ createdAt: '2026-08-08T19:00:00.000Z', inputTokens: 1000, outputTokens: 0 }),
        row({ createdAt: '2026-08-07T18:00:00.000Z', inputTokens: 1000, outputTokens: 0 }),
      ],
      (createdAt) => createdAt.slice(0, 10),
    );

    expect(result.map((d) => d.date)).toEqual(['2026-08-07', '2026-08-08']);
    expect(result[1].fermentationCount).toBe(2);
    expect(result[1].inputTokens).toBe(2000);
  });
});

describe('resolveUserEmails', () => {
  it('pages through listUsers beyond the 1000-user limit', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({
      id: `u${i}`,
      email: `u${i}@test.com`,
    }));
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ data: { users: firstPage } })
      .mockResolvedValueOnce({ data: { users: [{ id: 'u1000', email: 'u1000@test.com' }] } });
    // @type-assertion-allowed: テスト用の最小 Supabase auth admin スタブ
    const client = { auth: { admin: { listUsers } } } as unknown as SupabaseClient;

    const map = await resolveUserEmails(client);

    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(map.size).toBe(1001);
    expect(map.get('u1000')).toBe('u1000@test.com');
  });
});
