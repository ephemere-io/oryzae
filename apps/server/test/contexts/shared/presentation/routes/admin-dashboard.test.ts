import { describe, expect, it, vi } from 'vitest';
import {
  collectWriterIds,
  countReturning,
  countTotalUsers,
  parseTzOffset,
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

  it('閲覧者のオフセットでローカル暦日の区間に直す（Issue #367: JST で 9 時間ずれていた）', () => {
    // JST(UTC+9) の getTimezoneOffset() は -540。6/21 00:00 JST = 6/20 15:00 UTC。
    const p = resolveActivityPeriods(
      '2026-06-21',
      '2026-06-27',
      new Date('2026-06-28T00:00:00.000Z'),
      -540,
    );
    expect(p.currentStart).toBe('2026-06-20T15:00:00.000Z');
    expect(p.currentEnd).toBe('2026-06-27T14:59:59.999Z');
    expect(p.previousEnd).toBe('2026-06-20T14:59:59.999Z');
  });
});

describe('parseTzOffset', () => {
  it('数値をそのまま返す', () => {
    expect(parseTzOffset('-540')).toBe(-540);
  });

  it('未指定・非数値・範囲外は 0（＝UTC 基準）に落とす', () => {
    expect(parseTzOffset(undefined)).toBe(0);
    expect(parseTzOffset('abc')).toBe(0);
    expect(parseTzOffset('99999')).toBe(0);
  });
});

/** PostgREST の range ページングを再現する最小スタブ。 */
function createEntriesSupabase(rows: { user_id: string }[]) {
  const range = vi.fn((from: number, to: number) =>
    Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
  );
  const builder = {
    select: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range,
  };
  // @type-assertion-allowed: SupabaseClient 全体ではなく、この経路で使う chain だけを再現する
  const supabase = { from: vi.fn(() => builder) } as unknown as Parameters<
    typeof collectWriterIds
  >[0];
  return { supabase, range };
}

describe('collectWriterIds', () => {
  it('1000 件を超えてもページングして全部集める（Issue #367: 黙って打ち切られていた）', async () => {
    // 1000 件目までが user-a、それ以降に user-b が出る。1 ページだけだと b を見落とす。
    const rows = [
      ...Array.from({ length: 1000 }, () => ({ user_id: 'user-a' })),
      { user_id: 'user-b' },
    ];
    const { supabase, range } = createEntriesSupabase(rows);

    const ids = await collectWriterIds(supabase, 'start', 'end');

    expect(new Set(ids)).toEqual(new Set(['user-a', 'user-b']));
    expect(range).toHaveBeenCalledTimes(2);
  });

  it('1 ページに満たなければ 1 回で止める', async () => {
    const { supabase, range } = createEntriesSupabase([{ user_id: 'user-a' }]);

    await collectWriterIds(supabase, 'start', 'end');

    expect(range).toHaveBeenCalledTimes(1);
  });

  it('エラーは握らず投げる（0 件として静かに間違えない）', async () => {
    const builder = {
      select: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })),
    };
    // @type-assertion-allowed: 上と同じく chain だけを再現する
    const supabase = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof collectWriterIds
    >[0];

    await expect(collectWriterIds(supabase, 'start', 'end')).rejects.toThrow('boom');
  });
});

describe('countTotalUsers', () => {
  it('profiles の exact count を返す（listUsers の 1000 人上限を避ける）', async () => {
    const builder = {
      select: vi.fn(() => Promise.resolve({ count: 1234, error: null })),
    };
    // @type-assertion-allowed: この経路で使う chain だけを再現する
    const supabase = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof countTotalUsers
    >[0];

    await expect(countTotalUsers(supabase)).resolves.toBe(1234);
    expect(supabase.from).toHaveBeenCalledWith('profiles');
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
