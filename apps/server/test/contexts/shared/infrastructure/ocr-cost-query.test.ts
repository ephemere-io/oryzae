import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  aggregateOcrCost,
  aggregateOcrCostByDay,
  fetchOcrUsageRows,
  type OcrUsageRow,
} from '@/contexts/shared/infrastructure/ocr-cost-query.js';

// claude-pricing の公表単価をここに直接書いているのは、集計側が価格表を正しく
// 引けているか（= 発酵の単価で計算していないか）を独立に確かめるため。
const OPUS_IN = 5 / 1_000_000;
const OPUS_OUT = 25 / 1_000_000;
const SONNET_IN = 3 / 1_000_000;
const SONNET_OUT = 15 / 1_000_000;

function row(overrides: Partial<OcrUsageRow> = {}): OcrUsageRow {
  return {
    userId: 'user-1',
    model: 'claude-opus-5',
    inputTokens: 1000,
    outputTokens: 200,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

/** fermentation-cost-query.test.ts と同じ、PostgREST ビルダーの最小スタブ。 */
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

function usageRows(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, () => ({
    user_id: 'user-1',
    model: 'claude-opus-5',
    input_tokens: 10,
    output_tokens: 5,
    created_at: '2026-09-01T10:00:00.000Z',
  }));
}

describe('fetchOcrUsageRows', () => {
  it('短いページが返るまでページングする', async () => {
    const { client, rangeCalls } = createSupabaseStub([usageRows(1000), usageRows(3)]);

    const result = await fetchOcrUsageRows(client);

    expect(result.rows).toHaveLength(1003);
    expect(result.truncated).toBe(false);
    expect(rangeCalls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('1ページ目がちょうど上限件数なら次ページを取りに行く', async () => {
    // 1000 ちょうどで止めると Supabase 既定の打ち切りと同じ過少集計になる。
    const { client, rangeCalls } = createSupabaseStub([usageRows(1000), []]);

    const result = await fetchOcrUsageRows(client);

    expect(result.rows).toHaveLength(1000);
    expect(rangeCalls).toHaveLength(2);
  });

  it('上限ページ数に達したら truncated=true で知らせる', async () => {
    const fullPages = Array.from({ length: 50 }, () => usageRows(1000));
    const { client } = createSupabaseStub(fullPages);

    const result = await fetchOcrUsageRows(client);

    expect(result.rows).toHaveLength(50_000);
    expect(result.truncated).toBe(true);
  });

  it('スキーマがずれたら例外にする（黙って $0 にしない）', async () => {
    // input_tokens が欠けた場合。0 に丸めるとコストが静かに過少になる。
    const { client } = createSupabaseStub([
      [{ user_id: 'u1', model: 'claude-opus-5', output_tokens: 5, created_at: '2026-09-01' }],
    ]);

    await expect(fetchOcrUsageRows(client)).rejects.toThrow(/input_tokens/);
  });

  it('テーブルが無い等のエラーは握り潰さず投げる（0件と区別できなくなるため）', async () => {
    const builder = {
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      order: () => builder,
      range: () =>
        Promise.resolve({ data: null, error: { message: 'relation "ocr_usage" does not exist' } }),
    };
    const client = { from: () => ({ select: () => builder }) };
    // @type-assertion-allowed: テスト用の最小 Supabase スタブ
    const typed = client as unknown as SupabaseClient;

    await expect(fetchOcrUsageRows(typed)).rejects.toThrow('relation "ocr_usage" does not exist');
  });
});

describe('aggregateOcrCost', () => {
  it('OCR の単価（opus-5 $5/$25）で算出する', () => {
    const result = aggregateOcrCost([row({ inputTokens: 1000, outputTokens: 200 })]);

    expect(result.estimatedCostUsd).toBeCloseTo(1000 * OPUS_IN + 200 * OPUS_OUT, 12);
    expect(result.requestCount).toBe(1);
    expect(result.untrackedCount).toBe(0);
  });

  // このファイルを発酵側と分けている理由そのもの。合算してから一律単価を掛けると
  // 金額がズレるので、行ごとに model から単価を引き直せているかを固定する。
  it('モデルが混在しても行ごとに単価を引き直す', () => {
    const result = aggregateOcrCost([
      row({ model: 'claude-opus-5', inputTokens: 1000, outputTokens: 100 }),
      row({ model: 'claude-sonnet-4-6', inputTokens: 1000, outputTokens: 100 }),
    ]);

    const expected = 1000 * OPUS_IN + 100 * OPUS_OUT + (1000 * SONNET_IN + 100 * SONNET_OUT);
    expect(result.estimatedCostUsd).toBeCloseTo(expected, 12);
    // 一律 opus 単価で計算していたらこの値になる（そうなっていないことを示す）
    expect(result.estimatedCostUsd).not.toBeCloseTo(2 * (1000 * OPUS_IN + 100 * OPUS_OUT), 12);
  });

  it('価格表に無いモデルは金額 0 で数え、untracked に計上する', () => {
    const result = aggregateOcrCost([
      row({ model: 'claude-opus-5', inputTokens: 1000, outputTokens: 100 }),
      row({ model: 'some-unpriced-model', inputTokens: 9_999_999, outputTokens: 9_999_999 }),
    ]);

    // 未知モデルを既定単価で埋めていたら、金額が跳ね上がって気づけない。
    expect(result.estimatedCostUsd).toBeCloseTo(1000 * OPUS_IN + 100 * OPUS_OUT, 12);
    expect(result.untrackedCount).toBe(1);
    // トークン数自体は事実として合算する（金額が出せないだけ）。
    expect(result.inputTokens).toBe(1000 + 9_999_999);
  });

  it('byModel に unpriced フラグを立てる', () => {
    const result = aggregateOcrCost([
      row({ model: 'some-unpriced-model' }),
      row({ model: 'some-unpriced-model' }),
      row({ model: 'claude-opus-5' }),
    ]);

    const unknown = result.byModel.find((m) => m.model === 'some-unpriced-model');
    const known = result.byModel.find((m) => m.model === 'claude-opus-5');
    expect(unknown?.unpriced).toBe(true);
    expect(unknown?.requestCount).toBe(2);
    expect(known?.unpriced).toBe(false);
  });

  it('byUser は推定コスト降順', () => {
    const result = aggregateOcrCost([
      row({ userId: 'small', inputTokens: 10, outputTokens: 1 }),
      row({ userId: 'big', inputTokens: 10_000, outputTokens: 5_000 }),
      row({ userId: 'mid', inputTokens: 1_000, outputTokens: 500 }),
    ]);

    expect(result.byUser.map((u) => u.userId)).toEqual(['big', 'mid', 'small']);
  });

  it('同じユーザーの複数回をまとめる', () => {
    const result = aggregateOcrCost([
      row({ userId: 'u1', inputTokens: 100, outputTokens: 10 }),
      row({ userId: 'u1', inputTokens: 200, outputTokens: 20 }),
    ]);

    expect(result.byUser).toHaveLength(1);
    expect(result.byUser[0]?.requestCount).toBe(2);
    expect(result.byUser[0]?.inputTokens).toBe(300);
  });

  it('0 件なら全部ゼロ', () => {
    const result = aggregateOcrCost([]);

    expect(result.estimatedCostUsd).toBe(0);
    expect(result.requestCount).toBe(0);
    expect(result.byUser).toEqual([]);
    expect(result.byModel).toEqual([]);
  });
});

describe('aggregateOcrCostByDay', () => {
  it('渡された日付キーで日別にまとめ、日付昇順で返す', () => {
    const rows = [
      row({ createdAt: '2026-09-02T01:00:00.000Z', inputTokens: 100, outputTokens: 10 }),
      row({ createdAt: '2026-09-01T23:00:00.000Z', inputTokens: 200, outputTokens: 20 }),
      row({ createdAt: '2026-09-01T02:00:00.000Z', inputTokens: 300, outputTokens: 30 }),
    ];

    const daily = aggregateOcrCostByDay(rows, (createdAt) => createdAt.slice(0, 10));

    expect(daily.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02']);
    expect(daily[0]?.requestCount).toBe(2);
    expect(daily[0]?.inputTokens).toBe(500);
    expect(daily[1]?.estimatedCostUsd).toBeCloseTo(100 * OPUS_IN + 10 * OPUS_OUT, 12);
  });
});
