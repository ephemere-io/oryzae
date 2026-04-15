import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@/lib/api';
import { UnreadProvider, useUnread } from '@/lib/unread-context';

const STORAGE_KEY = 'oryzae_jar_last_seen_at';

function createMockApi(responses: Record<string, unknown>): ApiClient {
  return {
    baseUrl: 'http://localhost:3000',
    headers: {},
    fetch: vi.fn((url: string, _init?: RequestInit) => {
      const body = responses[url];
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: body !== undefined ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  };
}

function createWrapper(api: ApiClient | null, authLoading = false) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <UnreadProvider api={api} authLoading={authLoading}>
        {children}
      </UnreadProvider>
    );
  };
}

describe('useUnread', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns 0 when there are no questions', async () => {
    const api = createMockApi({ '/api/v1/questions': [] });
    const { result } = renderHook(() => useUnread(), {
      wrapper: createWrapper(api),
    });

    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith('/api/v1/questions');
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it('counts completed fermentations newer than lastSeenAt', async () => {
    // Set lastSeenAt to a past date
    localStorage.setItem(STORAGE_KEY, '2025-01-01T00:00:00.000Z');

    const api = createMockApi({
      '/api/v1/questions': [{ id: 'q1' }],
      '/api/v1/fermentations?questionId=q1': [
        { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2025-06-01T00:00:00.000Z' },
        { id: 'f2', questionId: 'q1', status: 'completed', createdAt: '2025-06-02T00:00:00.000Z' },
        { id: 'f3', questionId: 'q1', status: 'pending', createdAt: '2025-06-03T00:00:00.000Z' },
      ],
    });

    const { result } = renderHook(() => useUnread(), {
      wrapper: createWrapper(api),
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
    });
  });

  it('does not count fermentations older than lastSeenAt', async () => {
    localStorage.setItem(STORAGE_KEY, '2025-07-01T00:00:00.000Z');

    const api = createMockApi({
      '/api/v1/questions': [{ id: 'q1' }],
      '/api/v1/fermentations?questionId=q1': [
        { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2025-06-01T00:00:00.000Z' },
      ],
    });

    const { result } = renderHook(() => useUnread(), {
      wrapper: createWrapper(api),
    });

    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledWith('/api/v1/fermentations?questionId=q1');
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it('markSeen sets localStorage and resets count to 0', async () => {
    localStorage.setItem(STORAGE_KEY, '2025-01-01T00:00:00.000Z');

    const api = createMockApi({
      '/api/v1/questions': [{ id: 'q1' }],
      '/api/v1/fermentations?questionId=q1': [
        { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2025-06-01T00:00:00.000Z' },
      ],
    });

    const { result } = renderHook(() => useUnread(), {
      wrapper: createWrapper(api),
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(1);
    });

    act(() => {
      result.current.markSeen();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('does not fetch when authLoading is true', () => {
    const api = createMockApi({ '/api/v1/questions': [] });
    renderHook(() => useUnread(), {
      wrapper: createWrapper(api, true),
    });

    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch when api is null', () => {
    const { result } = renderHook(() => useUnread(), {
      wrapper: createWrapper(null),
    });

    expect(result.current.unreadCount).toBe(0);
  });
});
