import { describe, expect, it } from 'vitest';
import {
  jstTimeRangeOfUtcDay,
  previousUtcDateKey,
  toUtcDateKey,
  utcDayBounds,
  utcDayRangeIso,
  utcMonthBounds,
} from '@/contexts/shared/infrastructure/jst-day.js';

describe('toUtcDateKey', () => {
  it('returns the UTC calendar day of the instant', () => {
    // JST 8/10 08:59 はまだ UTC 8/9
    expect(toUtcDateKey(new Date('2026-08-09T23:59:59.999Z'))).toBe('2026-08-09');
    expect(toUtcDateKey(new Date('2026-08-10T00:00:00.000Z'))).toBe('2026-08-10');
  });
});

describe('utcDayBounds', () => {
  it('returns a half-open UTC day interval', () => {
    const { start, end } = utcDayBounds('2026-08-08');
    expect(start.toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });
});

describe('utcDayRangeIso', () => {
  it('spans the whole UTC day inclusively for gte/lte', () => {
    expect(utcDayRangeIso('2026-08-08')).toEqual({
      startIso: '2026-08-08T00:00:00.000Z',
      endIso: '2026-08-08T23:59:59.999Z',
    });
  });

  it('includes the nightly fermentation run (JST 03:00 = UTC 18:00) of the next JST day', () => {
    // 実額が UTC 日 8/8 に載る定期発酵は、同じ窓で件数にも載る
    const { startIso, endIso } = utcDayRangeIso('2026-08-08');
    const nightlyRun = '2026-08-08T18:00:00.000Z';
    expect(nightlyRun >= startIso && nightlyRun <= endIso).toBe(true);
  });
});

describe('previousUtcDateKey', () => {
  it('steps back one UTC day', () => {
    expect(previousUtcDateKey('2026-08-09')).toBe('2026-08-08');
  });

  it('crosses month and year boundaries', () => {
    expect(previousUtcDateKey('2026-09-01')).toBe('2026-08-31');
    expect(previousUtcDateKey('2027-01-01')).toBe('2026-12-31');
  });
});

describe('utcMonthBounds', () => {
  it('returns a half-open UTC month interval and its length', () => {
    const { start, end, daysInMonth } = utcMonthBounds('2026-08-15');
    expect(start.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(daysInMonth).toBe(31);
  });

  it('knows short months and leap Februaries', () => {
    expect(utcMonthBounds('2026-02-10').daysInMonth).toBe(28);
    expect(utcMonthBounds('2028-02-10').daysInMonth).toBe(29);
    expect(utcMonthBounds('2026-04-01').daysInMonth).toBe(30);
  });

  it('rolls the end into the next year for December', () => {
    expect(utcMonthBounds('2026-12-31').end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

// 「UTC 9/7」と書いても日本の読み手には何時から何時の話か分からない。
describe('jstTimeRangeOfUtcDay', () => {
  it('writes the UTC day as a JST clock range', () => {
    expect(jstTimeRangeOfUtcDay('2026-09-07')).toBe('9/7 9:00 〜 9/8 9:00 (JST)');
  });

  it('crosses month and year boundaries in the JST end time', () => {
    expect(jstTimeRangeOfUtcDay('2026-08-31')).toBe('8/31 9:00 〜 9/1 9:00 (JST)');
    expect(jstTimeRangeOfUtcDay('2026-12-31')).toBe('12/31 9:00 〜 1/1 9:00 (JST)');
  });
});
