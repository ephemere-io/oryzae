import { describe, expect, it } from 'vitest';
import { computeCostFromTokens } from '@/contexts/fermentation/infrastructure/llm/claude-pricing.js';

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
});
