import { describe, expect, it } from 'vitest';
import type { AdminUser } from '@/features/users/hooks/use-users';
import { ACTIVE_WINDOW_DAYS, deriveUserStatus } from '@/features/users/status';

const NOW = new Date('2026-09-15T00:00:00Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** NOW から n 日前の ISO 文字列。 */
function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * MS_PER_DAY).toISOString();
}

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

describe('deriveUserStatus', () => {
  it('エントリーが 1 件も無ければ never', () => {
    expect(deriveUserStatus(user({ entryCount: 0 }), NOW)).toBe('never');
  });

  it('直近に書いていれば active', () => {
    expect(deriveUserStatus(user({ entryCount: 3, lastActivityAt: daysAgo(1) }), NOW)).toBe(
      'active',
    );
  });

  it('窓より前にしか書いていなければ dormant', () => {
    expect(deriveUserStatus(user({ entryCount: 3, lastActivityAt: daysAgo(200) }), NOW)).toBe(
      'dormant',
    );
  });

  // 境界。ちょうど窓の端は dormant 側に含める（実装コメントと対応）。
  it('窓のちょうど境界は dormant、その 1 ミリ秒内側は active', () => {
    const exactly = new Date(NOW.getTime() - ACTIVE_WINDOW_DAYS * MS_PER_DAY).toISOString();
    const justInside = new Date(NOW.getTime() - ACTIVE_WINDOW_DAYS * MS_PER_DAY + 1).toISOString();

    expect(deriveUserStatus(user({ entryCount: 1, lastActivityAt: exactly }), NOW)).toBe('dormant');
    expect(deriveUserStatus(user({ entryCount: 1, lastActivityAt: justInside }), NOW)).toBe(
      'active',
    );
  });

  // #620 の本体。発酵は cron の自動実行なので、これで active になってはいけない。
  it('発酵が何件あってもエントリーが無ければ never のまま', () => {
    expect(
      deriveUserStatus(
        user({ entryCount: 0, fermentationTotal: 42, fermentationCompleted: 42 }),
        NOW,
      ),
    ).toBe('never');
  });

  it('発酵があっても、書いたのが窓より前なら dormant', () => {
    expect(
      deriveUserStatus(
        user({ entryCount: 1, lastActivityAt: daysAgo(200), fermentationTotal: 10 }),
        NOW,
      ),
    ).toBe('dormant');
  });

  it('失敗した発酵しか無いユーザーも never', () => {
    expect(
      deriveUserStatus(user({ entryCount: 0, fermentationTotal: 5, fermentationFailed: 5 }), NOW),
    ).toBe('never');
  });

  // 以下は防御。active を名乗らせる根拠が無い入力は dormant に倒す。
  it('エントリーはあるが最終活動が取れない場合は dormant', () => {
    expect(deriveUserStatus(user({ entryCount: 2, lastActivityAt: null }), NOW)).toBe('dormant');
  });

  it('最終活動の日付が壊れていても active にしない', () => {
    expect(deriveUserStatus(user({ entryCount: 2, lastActivityAt: 'not-a-date' }), NOW)).toBe(
      'dormant',
    );
  });
});
