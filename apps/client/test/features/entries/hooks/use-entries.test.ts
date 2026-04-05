import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntries } from '@/features/entries/hooks/use-entries';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: fetchImpl,
  };
}

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 400,
  } as Response;
}

describe('useEntries', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('fetches entries on mount when api is provided', async () => {
    const entries = [
      { id: '1', userId: 'u1', content: 'hello', mediaUrls: [], createdAt: '', updatedAt: '' },
    ];
    apiFetch.mockResolvedValueOnce(mockResponse(true, entries));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe('1');
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when authLoading is true', async () => {
    const api = createMockApi(apiFetch);

    renderHook(() => useEntries(api, true));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('returns empty array when no entries', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, []));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it('supports cursor-based pagination (loadMore)', async () => {
    const page1 = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      userId: 'u1',
      content: `entry ${i}`,
      mediaUrls: [],
      createdAt: '',
      updatedAt: '',
    }));
    const page2 = [
      { id: 'e20', userId: 'u1', content: 'entry 20', mediaUrls: [], createdAt: '', updatedAt: '' },
    ];

    apiFetch.mockResolvedValueOnce(mockResponse(true, page1));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);

    apiFetch.mockResolvedValueOnce(mockResponse(true, page2));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(21);
    expect(result.current.hasMore).toBe(false);
    expect(apiFetch.mock.calls[1][0]).toContain('cursor=e19');
  });
});
