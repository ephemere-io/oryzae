import { describe, expect, it } from 'vitest';
import { summarizeActualCostTrend } from '@/contexts/shared/infrastructure/cost-trend.js';

const AUGUST = [
  { date: '2026-08-01', costUsd: 0.1 },
  { date: '2026-08-02', costUsd: 0.2 },
  { date: '2026-08-03', costUsd: 0.3 },
  { date: '2026-08-04', costUsd: 0.4 },
];

describe('summarizeActualCostTrend', () => {
  it('picks the target day out of the month and compares it with the day before', () => {
    const trend = summarizeActualCostTrend(AUGUST, '2026-08-03');

    expect(trend.todayUsd).toBeCloseTo(0.3, 6);
    expect(trend.previousUsd).toBeCloseTo(0.2, 6);
    expect(trend.changeRatio).toBeCloseTo(0.5, 6);
  });

  it('accumulates only up to the target day, ignoring later buckets', () => {
    // 実額の反映ラグで対象日より後のバケットが混ざっても、月累計は対象日で切る。
    const trend = summarizeActualCostTrend(AUGUST, '2026-08-03');

    expect(trend.monthToDateUsd).toBeCloseTo(0.6, 6);
    expect(trend.elapsedDays).toBe(3);
    expect(trend.daysInMonth).toBe(31);
    expect(trend.dailyAverageUsd).toBeCloseTo(0.2, 6);
    expect(trend.projectedMonthEndUsd).toBeCloseTo(6.2, 6);
  });

  it('excludes other months from the month-to-date total', () => {
    const trend = summarizeActualCostTrend(
      [
        { date: '2026-07-31', costUsd: 5 },
        { date: '2026-08-01', costUsd: 0.1 },
      ],
      '2026-08-01',
    );

    expect(trend.monthToDateUsd).toBeCloseTo(0.1, 6);
    // 前月末は前日として読む（月初でも前日比が出る）
    expect(trend.previousUsd).toBeCloseTo(5, 6);
  });

  it('reports an unknown previous day as null instead of $0', () => {
    const trend = summarizeActualCostTrend([{ date: '2026-08-05', costUsd: 0.5 }], '2026-08-05');

    expect(trend.previousUsd).toBeNull();
    expect(trend.changeRatio).toBeNull();
  });

  it('leaves the change ratio null when the previous day was $0', () => {
    // 0 除算を避ける。「$0 から $0.20」は +∞% であって比率にならない。
    const trend = summarizeActualCostTrend(
      [
        { date: '2026-08-04', costUsd: 0 },
        { date: '2026-08-05', costUsd: 0.2 },
      ],
      '2026-08-05',
    );

    expect(trend.previousUsd).toBe(0);
    expect(trend.changeRatio).toBeNull();
  });

  it('treats a missing target bucket as no spend', () => {
    const trend = summarizeActualCostTrend(AUGUST, '2026-08-10');

    expect(trend.todayUsd).toBe(0);
    expect(trend.monthToDateUsd).toBeCloseTo(1.0, 6);
  });

  it('sums duplicate buckets for the same day', () => {
    const trend = summarizeActualCostTrend(
      [
        { date: '2026-08-03', costUsd: 0.1 },
        { date: '2026-08-03', costUsd: 0.2 },
      ],
      '2026-08-03',
    );

    expect(trend.todayUsd).toBeCloseTo(0.3, 6);
  });

  it('uses the real length of the month for the projection', () => {
    const trend = summarizeActualCostTrend([{ date: '2026-02-01', costUsd: 1 }], '2026-02-01');

    expect(trend.daysInMonth).toBe(28);
    expect(trend.projectedMonthEndUsd).toBeCloseTo(28, 6);
  });
});
