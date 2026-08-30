import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { UnreadProvider, type UnreadState, useUnread } from '@/lib/unread-context';

// fetch と既読の永続化は features/shared/fermentation/hooks/use-unread-letters が持つ
// （検証はそちらの test に集約）。ここは context が「値を配るだけの器」であることだけを見る。

function makeState(overrides: Partial<UnreadState> = {}): UnreadState {
  return {
    ready: true,
    unreadCount: 3,
    unreadQuestionIds: new Set(['q1']),
    markQuestionRead: vi.fn(),
    markAllSeen: vi.fn(),
    ...overrides,
  };
}

describe('UnreadContext', () => {
  it('provider が無くても既定値に落ちる（孤立検証で crash しない）', () => {
    const { result } = renderHook(() => useUnread());

    // 未取得の間は印を出さない（未読マークがちらつかない）。
    expect(result.current.ready).toBe(false);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.unreadQuestionIds.size).toBe(0);
  });

  it('provider に渡した値をそのまま配る', () => {
    const value = makeState();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <UnreadProvider value={value}>{children}</UnreadProvider>
    );

    const { result } = renderHook(() => useUnread(), { wrapper });

    expect(result.current.unreadCount).toBe(3);
    expect([...result.current.unreadQuestionIds]).toEqual(['q1']);
    result.current.markQuestionRead('q1');
    expect(value.markQuestionRead).toHaveBeenCalledWith('q1');
  });
});
