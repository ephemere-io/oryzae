import { describe, expect, it } from 'vitest';
import { jstDayRangeUtc, previousJstDateKey } from '@/contexts/shared/infrastructure/jst-day.js';

describe('previousJstDateKey', () => {
  it('returns the JST day before the given instant', () => {
    // コスト cron は JST 10:00 (= UTC 01:00) に走る
    expect(previousJstDateKey(new Date('2026-08-10T01:00:00.000Z'))).toBe('2026-08-09');
  });

  it('handles the UTC month boundary', () => {
    expect(previousJstDateKey(new Date('2026-09-01T01:00:00.000Z'))).toBe('2026-08-31');
  });
});

describe('jstDayRangeUtc', () => {
  it('spans 15:00 UTC of the previous day to 14:59:59.999 UTC of the day', () => {
    expect(jstDayRangeUtc('2026-08-09')).toEqual({
      startIso: '2026-08-08T15:00:00.000Z',
      endIso: '2026-08-09T14:59:59.999Z',
    });
  });

  it('includes the nightly fermentation run for that JST day', () => {
    const { startIso, endIso } = jstDayRangeUtc('2026-08-09');
    const runAt = '2026-08-08T18:00:00.000Z'; // JST 8/9 03:00
    expect(runAt >= startIso).toBe(true);
    expect(runAt <= endIso).toBe(true);
  });

  it('excludes the next JST day’s run (the bug the UTC-day window had)', () => {
    const { endIso } = jstDayRangeUtc('2026-08-09');
    const nextRunAt = '2026-08-09T18:00:00.000Z'; // JST 8/10 03:00
    expect(nextRunAt > endIso).toBe(true);
  });
});
