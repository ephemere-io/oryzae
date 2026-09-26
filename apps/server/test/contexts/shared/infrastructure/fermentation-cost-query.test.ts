import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateCost,
  aggregateCostByDay,
  type FermentationCostRow,
  fetchFermentationCostRows,
  resolveUserEmails,
  resolveUserNicknames,
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
 * fermentation_results は range(offset, end) ごとに pages[] から1ページ返す。
 * ai_usage は usage[] のうち in('ref_id', ids) に当たる行を返す。
 */
function createSupabaseStub(
  pages: Record<string, unknown>[][],
  usage: Record<string, unknown>[] = [],
) {
  const rangeCalls: [number, number][] = [];
  const fermentations = {
    eq: () => fermentations,
    gte: () => fermentations,
    lte: () => fermentations,
    order: () => fermentations,
    range: (from: number, to: number) => {
      rangeCalls.push([from, to]);
      const page = pages.shift() ?? [];
      return Promise.resolve({ data: page, error: null });
    },
  };
  const aiUsage = {
    eq: () => aiUsage,
    in: (_column: string, ids: string[]) =>
      Promise.resolve({
        data: usage.filter((u) => typeof u.ref_id === 'string' && ids.includes(u.ref_id)),
        error: null,
      }),
  };
  const client = {
    from: (table: string) => ({
      select: () => (table === 'ai_usage' ? aiUsage : fermentations),
    }),
  };
  // @type-assertion-allowed: テスト用の最小 Supabase スタブ。実際に使うのは from().select() 以降だけ
  return { client: client as unknown as SupabaseClient, rangeCalls };
}

function fermentationRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    user_id: 'user-1',
    status: 'completed',
    created_at: '2026-08-08T18:00:00.000Z',
    ...over,
  };
}

function usageRow(refId: string, inputTokens: number, outputTokens: number) {
  return {
    user_id: 'user-1',
    feature: 'fermentation',
    ref_id: refId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}

describe('fetchFermentationCostRows', () => {
  it('pages through results until a short page is returned', async () => {
    // 旧実装は .range() 無しで Supabase 既定の 1000 行に暗黙に打ち切られていた。
    const firstPage = Array.from({ length: 1000 }, (_, i) => fermentationRow(`f${i}`));
    const secondPage = [fermentationRow('last', { user_id: 'user-2' })];
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
    const { client, rangeCalls } = createSupabaseStub([[fermentationRow('f1')]]);

    const result = await fetchFermentationCostRows(client);

    expect(result.rows).toHaveLength(1);
    expect(rangeCalls).toHaveLength(1);
  });

  it('トークン数は ai_usage から引き、再試行の分も足し合わせる', async () => {
    const { client } = createSupabaseStub(
      [[fermentationRow('f1'), fermentationRow('f2')]],
      [usageRow('f1', 100, 10), usageRow('f1', 200, 20), usageRow('f2', 50, 5)],
    );

    const result = await fetchFermentationCostRows(client);

    expect(result.rows.map((r) => [r.inputTokens, r.outputTokens])).toEqual([
      [300, 30],
      [50, 5],
    ]);
  });

  it('ai_usage に記録が無い発酵は 0 ではなく null にする（未追跡として数えるため）', async () => {
    const { client } = createSupabaseStub([[fermentationRow('f1', { status: 'failed' })]]);

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

describe('resolveUserNicknames', () => {
  function profilesClient(result: { data: unknown; error: { message: string } | null }) {
    const inFn = vi.fn().mockResolvedValue(result);
    const select = vi.fn().mockReturnValue({ in: inFn });
    const from = vi.fn().mockReturnValue({ select });
    // @type-assertion-allowed: テスト用の最小 Supabase from/select/in スタブ
    const client = { from } as unknown as SupabaseClient;
    return { client, from, select, inFn };
  }

  it('requests only the given ids from profiles and maps id → nickname', async () => {
    const { client, from, select, inFn } = profilesClient({
      data: [
        { id: 'u1', nickname: 'あきら' },
        { id: 'u2', nickname: 'ばば' },
      ],
      error: null,
    });

    const map = await resolveUserNicknames(client, ['u1', 'u2']);

    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('id, nickname');
    expect(inFn).toHaveBeenCalledWith('id', ['u1', 'u2']);
    expect(map.get('u1')).toBe('あきら');
    expect(map.get('u2')).toBe('ばば');
  });

  it('does not query when there is nobody to resolve', async () => {
    const { client, from } = profilesClient({ data: [], error: null });

    const map = await resolveUserNicknames(client, []);

    expect(from).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });

  it('degrades to an empty map on a query error (the report must still go out)', async () => {
    const { client } = profilesClient({ data: null, error: { message: 'permission denied' } });

    const map = await resolveUserNicknames(client, ['u1']);

    expect(map.size).toBe(0);
  });
});
