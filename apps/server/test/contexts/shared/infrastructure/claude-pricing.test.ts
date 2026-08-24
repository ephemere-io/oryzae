import { describe, expect, it } from 'vitest';
import { computeCostFromTokens } from '@/contexts/shared/infrastructure/claude-pricing.js';

describe('computeCostFromTokens', () => {
  it('両方 null/undefined なら null (コスト不明)', () => {
    expect(computeCostFromTokens(null, null)).toBeNull();
    expect(computeCostFromTokens(undefined, undefined)).toBeNull();
  });

  it('claude-sonnet-4-6 価格で算出する ($3/1M in, $15/1M out)', () => {
    const cost = computeCostFromTokens(1_000_000, 1_000_000);
    expect(cost).not.toBeNull();
    expect(cost?.totalCost).toBeCloseTo(18.0, 10); // 3 + 15
    expect(cost?.promptTokens).toBe(1_000_000);
    expect(cost?.completionTokens).toBe(1_000_000);
  });

  it('現実的なトークン数で算出する', () => {
    const cost = computeCostFromTokens(5000, 2000);
    // 5000*3/1e6 + 2000*15/1e6 = 0.015 + 0.030 = 0.045
    expect(cost?.totalCost).toBeCloseTo(0.045, 10);
  });

  it('片方だけ欠けても 0 扱いで算出する', () => {
    const cost = computeCostFromTokens(1000, null);
    expect(cost?.totalCost).toBeCloseTo(0.003, 10);
    expect(cost?.completionTokens).toBe(0);
  });

  // 文字起こし (photo_transcription_usages) はモデル名を保存するので単価が引ける。
  it('モデルを指定するとそのモデルの単価で算出する', () => {
    // haiku: $1/1M in, $5/1M out → 1000*1 + 1000*5 = 0.006
    const haiku = computeCostFromTokens(1000, 1000, 'claude-haiku-4-5');
    expect(haiku?.totalCost).toBeCloseTo(0.006, 10);

    // opus: $5/1M in, $25/1M out → 0.03
    const opus = computeCostFromTokens(1000, 1000, 'claude-opus-5');
    expect(opus?.totalCost).toBeCloseTo(0.03, 10);
  });

  it('モデル未指定は発酵のモデル (claude-sonnet-4-6) を既定にする', () => {
    expect(computeCostFromTokens(1000, 1000)?.totalCost).toBeCloseTo(
      computeCostFromTokens(1000, 1000, 'claude-sonnet-4-6')?.totalCost ?? Number.NaN,
      10,
    );
    expect(computeCostFromTokens(1000, 1000, null)?.totalCost).toBeCloseTo(0.018, 10);
  });

  // 未知のモデルを 0 円にすると、モデル差し替え時に集計が黙って過少になる。
  it('未知のモデル名でも 0 円にはせず既定の単価で算出する', () => {
    const unknown = computeCostFromTokens(1000, 1000, 'claude-something-new');
    expect(unknown?.totalCost).toBeCloseTo(0.018, 10);
  });
});
