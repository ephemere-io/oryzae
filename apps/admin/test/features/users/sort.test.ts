import { describe, expect, it } from 'vitest';
import type { AdminUser } from '@/features/users/hooks/use-users';
import { compareNullableDates, compareUsers } from '@/features/users/sort';

function user(overrides: Partial<AdminUser>): AdminUser {
  return {
    id: 'u',
    email: 'a@test.com',
    createdAt: '2026-01-01T00:00:00Z',
    lastSignInAt: null,
    lastActivityAt: null,
    entryCount: 0,
    questionCount: 0,
    fermentationTotal: 0,
    fermentationCompleted: 0,
    fermentationFailed: 0,
    ...overrides,
  };
}

describe('compareNullableDates', () => {
  it('新しい方が後ろに来る（昇順）', () => {
    expect(compareNullableDates('2026-01-01', '2026-02-01', 'asc')).toBeLessThan(0);
  });

  it('降順では新しい方が前に来る', () => {
    expect(compareNullableDates('2026-01-01', '2026-02-01', 'desc')).toBeGreaterThan(0);
  });

  // 未記録が先頭を占めると一覧が読めないので、向きに関わらず末尾へ。
  it('未記録は昇順でも降順でも末尾に寄る', () => {
    expect(compareNullableDates(null, '2026-01-01', 'asc')).toBeGreaterThan(0);
    expect(compareNullableDates(null, '2026-01-01', 'desc')).toBeGreaterThan(0);
    expect(compareNullableDates('2026-01-01', null, 'asc')).toBeLessThan(0);
    expect(compareNullableDates('2026-01-01', null, 'desc')).toBeLessThan(0);
  });

  // ここが NaN を返すと sort の結果は仕様上未定義になり、無関係な行の順序まで崩れる。
  it('両方とも未記録なら 0（NaN を返さない）', () => {
    for (const dir of ['asc', 'desc'] as const) {
      const result = compareNullableDates(null, null, dir);
      expect(result).toBe(0);
      expect(Number.isNaN(result)).toBe(false);
    }
  });
});

describe('compareUsers', () => {
  it('未記録のユーザーが複数いても、記録のある行が先に並ぶ', () => {
    const users = [
      user({ id: 'none1', lastActivityAt: null }),
      user({ id: 'old', lastActivityAt: '2026-01-01T00:00:00Z' }),
      user({ id: 'none2', lastActivityAt: null }),
      user({ id: 'new', lastActivityAt: '2026-03-01T00:00:00Z' }),
    ];

    const desc = [...users].sort((a, b) => compareUsers(a, b, 'lastActivityAt', 'desc'));
    expect(desc.slice(0, 2).map((u) => u.id)).toEqual(['new', 'old']);
    expect(
      desc
        .slice(2)
        .map((u) => u.id)
        .sort(),
    ).toEqual(['none1', 'none2']);

    const asc = [...users].sort((a, b) => compareUsers(a, b, 'lastActivityAt', 'asc'));
    expect(asc.slice(0, 2).map((u) => u.id)).toEqual(['old', 'new']);
    expect(
      asc
        .slice(2)
        .map((u) => u.id)
        .sort(),
    ).toEqual(['none1', 'none2']);
  });

  it('最終ログインでも同じ規則が効く', () => {
    const users = [
      user({ id: 'never', lastSignInAt: null }),
      user({ id: 'recent', lastSignInAt: '2026-05-01T00:00:00Z' }),
    ];

    expect(
      [...users].sort((a, b) => compareUsers(a, b, 'lastSignInAt', 'desc')).map((u) => u.id),
    ).toEqual(['recent', 'never']);
  });

  it('数値列は素直に大小で並ぶ', () => {
    const users = [user({ id: 'a', entryCount: 1 }), user({ id: 'b', entryCount: 9 })];

    expect(
      [...users].sort((a, b) => compareUsers(a, b, 'entryCount', 'desc')).map((u) => u.id),
    ).toEqual(['b', 'a']);
  });
});
