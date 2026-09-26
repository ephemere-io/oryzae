import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateAiUsage,
  fetchAiUsage,
  fetchFermentationTokens,
} from '@/contexts/shared/infrastructure/ai-usage-query';

const row = (over: Partial<Parameters<typeof aggregateAiUsage>[0][number]>) => ({
  userId: 'u1',
  feature: 'ocr_board' as const,
  refId: null,
  inputTokens: 100,
  outputTokens: 10,
  ...over,
});

describe('aggregateAiUsage', () => {
  it('機能ごとに回数・トークンを数える', () => {
    const result = aggregateAiUsage([
      row({}),
      row({}),
      row({ feature: 'ocr_entry', inputTokens: 1800, outputTokens: 40 }),
      row({ feature: 'fermentation', refId: 'f1', inputTokens: 3105, outputTokens: 3898 }),
    ]);

    expect(result.ocr_board).toMatchObject({ count: 2, inputTokens: 200, outputTokens: 20 });
    expect(result.ocr_entry).toMatchObject({ count: 1, inputTokens: 1800, outputTokens: 40 });
    expect(result.fermentation).toMatchObject({ count: 1, inputTokens: 3105 });
  });

  it('ユーザー別は回数の多い順に並べる', () => {
    const result = aggregateAiUsage([
      row({ userId: 'a' }),
      row({ userId: 'b' }),
      row({ userId: 'b' }),
    ]);

    expect(result.ocr_board.byUser.map((u) => [u.userId, u.count])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });

  it('使われなかった機能も 0 として持つ（欠けた機能を「読めなかった」と取り違えない）', () => {
    const result = aggregateAiUsage([]);

    expect(result.fermentation.count).toBe(0);
    expect(result.ocr_board.count).toBe(0);
    expect(result.ocr_entry.count).toBe(0);
  });
});

function fakeSupabase(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
    in: vi.fn().mockResolvedValue(result),
  };
  const from = vi.fn().mockReturnValue(chain);
  // @type-assertion-allowed: テスト用に from() のクエリチェーンだけを持つ最小のスタブを SupabaseClient として渡す
  const client = { from } as unknown as SupabaseClient;
  return { client, chain, from };
}

const RANGE = { startIso: '2026-09-25T00:00:00.000Z', endIso: '2026-09-25T23:59:59.999Z' };

describe('fetchAiUsage', () => {
  it('窓の中の記録を読んで集計する', async () => {
    const { client, chain, from } = fakeSupabase({
      data: [
        {
          user_id: 'u1',
          feature: 'ocr_entry',
          ref_id: null,
          input_tokens: 1800,
          output_tokens: 40,
        },
      ],
      error: null,
    });

    const result = await fetchAiUsage(client, RANGE);

    expect(from).toHaveBeenCalledWith('ai_usage');
    expect(chain.gte).toHaveBeenCalledWith('created_at', RANGE.startIso);
    expect(chain.lte).toHaveBeenCalledWith('created_at', RANGE.endIso);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.byFeature.ocr_entry.count).toBe(1);
  });

  // migration 未適用だと表が無い。それを「0 回」と出すと、使われていないように読める。
  it('読めなかったときは 0 回ではなくエラーとして返す', async () => {
    const { client } = fakeSupabase({
      data: null,
      error: { message: 'relation "public.ai_usage" does not exist' },
    });

    const result = await fetchAiUsage(client, RANGE);

    expect(result).toEqual({
      kind: 'error',
      message: 'relation "public.ai_usage" does not exist',
    });
  });
});

describe('fetchFermentationTokens', () => {
  it('再試行で行が複数ある発酵は、その発酵の合計にする', async () => {
    const { client, chain } = fakeSupabase({
      data: [
        {
          user_id: 'u1',
          feature: 'fermentation',
          ref_id: 'f1',
          input_tokens: 100,
          output_tokens: 10,
        },
        {
          user_id: 'u1',
          feature: 'fermentation',
          ref_id: 'f1',
          input_tokens: 200,
          output_tokens: 20,
        },
        {
          user_id: 'u2',
          feature: 'fermentation',
          ref_id: 'f2',
          input_tokens: 50,
          output_tokens: 5,
        },
      ],
      error: null,
    });

    const result = await fetchFermentationTokens(client, ['f1', 'f2', 'f3']);

    expect(chain.eq).toHaveBeenCalledWith('feature', 'fermentation');
    expect(result.get('f1')).toEqual({ inputTokens: 300, outputTokens: 30 });
    expect(result.get('f2')).toEqual({ inputTokens: 50, outputTokens: 5 });
    // 記録の無い発酵は入らない（0 トークンと取り違えない）
    expect(result.has('f3')).toBe(false);
  });

  it('id が多いときは URL に収まるよう分けて引く', async () => {
    const { client, chain } = fakeSupabase({ data: [], error: null });
    const ids = Array.from({ length: 450 }, (_, i) => `f${i}`);

    await fetchFermentationTokens(client, ids);

    expect(chain.in).toHaveBeenCalledTimes(3);
    expect(chain.in.mock.calls[0]?.[1]).toHaveLength(200);
    expect(chain.in.mock.calls[2]?.[1]).toHaveLength(50);
  });

  it('id が無ければ問い合わせない', async () => {
    const { client, from } = fakeSupabase({ data: [], error: null });

    expect((await fetchFermentationTokens(client, [])).size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it('読めなかったときは例外にする', async () => {
    const { client } = fakeSupabase({ data: null, error: { message: 'boom' } });

    await expect(fetchFermentationTokens(client, ['f1'])).rejects.toThrow(
      'ai_usage select failed: boom',
    );
  });
});
