import { describe, expect, it } from 'vitest';
import {
  jstDayRangeUtc,
  previousJstDateKey,
  previousUtcDateKey,
  toJstDateKey,
  utcDateKeyOfJstFermentationRun,
  utcDayBounds,
  utcMonthBounds,
} from '@/contexts/shared/infrastructure/jst-day.js';

describe('toJstDateKey', () => {
  it('advances to the next JST day for times at or after 15:00 UTC', () => {
    // UTC 8/8 15:00 = JST 8/9 00:00
    expect(toJstDateKey(new Date('2026-08-08T15:00:00.000Z'))).toBe('2026-08-09');
    expect(toJstDateKey(new Date('2026-08-08T14:59:59.999Z'))).toBe('2026-08-08');
  });

  it('maps the nightly fermentation run (UTC 18:00) to the next JST day', () => {
    // 発酵 cron は JST 03:00 = UTC 前日 18:00 に走る
    expect(toJstDateKey(new Date('2026-08-08T18:00:00.000Z'))).toBe('2026-08-09');
  });
});

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

describe('utcDateKeyOfJstFermentationRun', () => {
  it('maps a JST day to the UTC day its nightly run landed in', () => {
    expect(utcDateKeyOfJstFermentationRun('2026-08-09')).toBe('2026-08-08');
    expect(utcDateKeyOfJstFermentationRun('2026-09-01')).toBe('2026-08-31');
  });
});

describe('utcDayBounds', () => {
  it('returns a half-open UTC day interval', () => {
    const { start, end } = utcDayBounds('2026-08-08');
    expect(start.toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });
});

describe('previousUtcDateKey', () => {
  it('steps back one UTC day', () => {
    expect(previousUtcDateKey('2026-08-08')).toBe('2026-08-07');
  });

  it('crosses month and year boundaries', () => {
    expect(previousUtcDateKey('2026-08-01')).toBe('2026-07-31');
    expect(previousUtcDateKey('2026-01-01')).toBe('2025-12-31');
    expect(previousUtcDateKey('2028-03-01')).toBe('2028-02-29');
  });
});

describe('utcMonthBounds', () => {
  it('returns a half-open UTC month interval and its length', () => {
    const { start, end, daysInMonth } = utcMonthBounds('2026-08-08');
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(daysInMonth).toBe(31);
  });

  it('knows short months and leap Februaries', () => {
    expect(utcMonthBounds('2026-02-15').daysInMonth).toBe(28);
    expect(utcMonthBounds('2028-02-15').daysInMonth).toBe(29);
    expect(utcMonthBounds('2026-04-30').daysInMonth).toBe(30);
  });

  it('rolls the end into the next year for December', () => {
    const { end } = utcMonthBounds('2026-12-31');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
