import { describe, expect, it } from 'vitest';
import { getFermentationTargetDateKey } from '@/contexts/fermentation/presentation/routes/cron-target-date.js';

describe('getFermentationTargetDateKey', () => {
  it('returns the previous JST day when cron fires at JST 03:00 (UTC 18:00)', () => {
    // 2026-04-16T18:00:00Z = JST 2026-04-17T03:00:00
    // Cron fires here, but target is entries written on 2026-04-16 (JST)
    const now = new Date('2026-04-16T18:00:00.000Z');
    expect(getFermentationTargetDateKey(now)).toBe('2026-04-16');
  });

  it('handles month boundaries correctly', () => {
    // Cron fires at JST 2026-05-01T03:00:00 (= UTC 2026-04-30T18:00:00)
    // Target should be JST 2026-04-30
    const now = new Date('2026-04-30T18:00:00.000Z');
    expect(getFermentationTargetDateKey(now)).toBe('2026-04-30');
  });

  it('handles year boundaries correctly', () => {
    // Cron fires at JST 2027-01-01T03:00:00 (= UTC 2026-12-31T18:00:00)
    // Target should be JST 2026-12-31
    const now = new Date('2026-12-31T18:00:00.000Z');
    expect(getFermentationTargetDateKey(now)).toBe('2026-12-31');
  });

  it('handles leap day boundaries', () => {
    // Cron fires at JST 2028-03-01T03:00:00 (= UTC 2028-02-29T18:00:00)
    // Target should be JST 2028-02-29
    const now = new Date('2028-02-29T18:00:00.000Z');
    expect(getFermentationTargetDateKey(now)).toBe('2028-02-29');
  });
});
