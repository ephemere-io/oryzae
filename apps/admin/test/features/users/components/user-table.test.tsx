import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserTable } from '@/features/users/components/user-table';
import type { AdminUser } from '@/features/users/hooks/use-users';

const NOW = new Date('2026-09-15T00:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

/** 3 状態がちょうど 1 人ずつ。 */
const USERS: AdminUser[] = [
  user({
    id: 'recent',
    email: 'recent@test.com',
    entryCount: 5,
    lastActivityAt: '2026-09-10T00:00:00Z',
  }),
  user({
    id: 'stale',
    email: 'stale@test.com',
    entryCount: 3,
    lastActivityAt: '2026-05-01T00:00:00Z',
  }),
  // エントリー 0 件だが発酵レコードだけある。#620 以前はこれが Active と表示されていた。
  user({ id: 'ferm-only', email: 'ferm@test.com', entryCount: 0, fermentationTotal: 7 }),
];

/**
 * 状態列（最終列）のテキストを行順に返す。
 *
 * `tbody` に限定するのは、合計行（`tfoot`）の末尾セルが空文字で紛れ込むため。
 */
function statusCells(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('tbody tr')).map((row) => {
    const cells = row.querySelectorAll('td');
    return cells[cells.length - 1]?.textContent?.trim() ?? '';
  });
}

describe('UserTable の状態列', () => {
  it('3 状態をそれぞれ表示する', () => {
    const { container } = render(<UserTable users={USERS} />);
    expect(statusCells(container).sort()).toEqual(['Active', 'Dormant', 'Never']);
  });

  // #620 の本体。発酵だけのユーザーが Active に数えられてはいけない。
  it('発酵レコードしか無いユーザーは Never', () => {
    const { container } = render(<UserTable users={[USERS[2]]} />);
    expect(statusCells(container)).toEqual(['Never']);
  });

  it('active フィルタは直近に書いた人だけに絞る', () => {
    render(<UserTable users={USERS} statusFilter="active" />);
    expect(screen.getByText('recent@test.com')).toBeTruthy();
    expect(screen.queryByText('stale@test.com')).toBeNull();
    expect(screen.queryByText('ferm@test.com')).toBeNull();
  });

  it('dormant フィルタは書いたが間が空いた人だけに絞る', () => {
    render(<UserTable users={USERS} statusFilter="dormant" />);
    expect(screen.getByText('stale@test.com')).toBeTruthy();
    expect(screen.queryByText('recent@test.com')).toBeNull();
    expect(screen.queryByText('ferm@test.com')).toBeNull();
  });

  it('never フィルタは一度も書いていない人だけに絞る', () => {
    render(<UserTable users={USERS} statusFilter="never" />);
    expect(screen.getByText('ferm@test.com')).toBeTruthy();
    expect(screen.queryByText('recent@test.com')).toBeNull();
    expect(screen.queryByText('stale@test.com')).toBeNull();
  });

  it('all フィルタでは全員出る', () => {
    const { container } = render(<UserTable users={USERS} statusFilter="all" />);
    expect(statusCells(container)).toHaveLength(3);
  });
});
