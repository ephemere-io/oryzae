import { describe, expect, it } from 'vitest';
import {
  countReturning,
  resolveActivityPeriods,
} from '@/contexts/shared/presentation/routes/admin-dashboard.js';

describe('resolveActivityPeriods', () => {
  it('明示された期間と、その直前の同じ長さの期間を返す', () => {
    const p = resolveActivityPeriods(
      '2026-06-21',
      '2026-06-27',
      new Date('2026-06-28T00:00:00.000Z'),
    );
    expect(p.currentStart).toBe('2026-06-21T00:00:00.000Z');
    expect(p.currentEnd).toBe('2026-06-27T23:59:59.999Z');
    // 直前期間は現在期間開始の直前まで（同じ長さ）
    expect(p.previousEnd).toBe('2026-06-20T23:59:59.999Z');
    expect(p.previousStart).toBe('2026-06-14T00:00:00.001Z');
  });

  it('期間未指定なら直近7日 / now にフォールバックする', () => {
    const now = new Date('2026-06-28T12:00:00.000Z');
    const p = resolveActivityPeriods(undefined, undefined, now);
    expect(p.currentStart).toBe('2026-06-21T12:00:00.000Z');
    expect(p.currentEnd).toBe('2026-06-28T12:00:00.000Z');
    expect(p.previousEnd).toBe('2026-06-21T11:59:59.999Z');
    expect(p.previousStart).toBe('2026-06-14T12:00:00.000Z');
  });
});

describe('countReturning', () => {
  it('重複を除いたアクティブ数・直前アクティブ数・継続数を数える', () => {
    const r = countReturning(['a', 'b', 'c', 'a'], ['b', 'c', 'd']);
    expect(r.activeWriters).toBe(3); // {a,b,c}
    expect(r.previousActiveUsers).toBe(3); // {b,c,d}
    expect(r.returningUsers).toBe(2); // {b,c}
  });

  it('重なりが無ければ継続は0', () => {
    expect(countReturning(['a'], ['b'])).toEqual({
      activeWriters: 1,
      previousActiveUsers: 1,
      returningUsers: 0,
    });
  });

  it('空入力でも壊れない', () => {
    expect(countReturning([], [])).toEqual({
      activeWriters: 0,
      previousActiveUsers: 0,
      returningUsers: 0,
    });
  });
});
