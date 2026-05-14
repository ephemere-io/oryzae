import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserMe } from '@/features/entries/hooks/use-user-me';
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

describe('useUserMe (Issue #316)', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('api が null のときは fetch せず loading=true のまま', () => {
    const { result } = renderHook(() => useUserMe(null));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('/api/v1/users/me を叩いて data に hasPickled / hasLinkedQuestion をセットする', async () => {
    const me = {
      id: 'u1',
      nickname: 'taro',
      avatarUrl: null,
      onboardingCompleted: true,
      hasPickled: false,
      hasLinkedQuestion: true,
    };
    apiFetch.mockResolvedValueOnce(mockResponse(true, me));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useUserMe(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/users/me');
    expect(result.current.data).toEqual(me);
  });

  it('refresh() で再 fetch して新しい値を返す', async () => {
    const initial = {
      id: 'u1',
      nickname: 'taro',
      avatarUrl: null,
      onboardingCompleted: true,
      hasPickled: false,
      hasLinkedQuestion: false,
    };
    const updated = { ...initial, hasPickled: true };
    apiFetch
      .mockResolvedValueOnce(mockResponse(true, initial))
      .mockResolvedValueOnce(mockResponse(true, updated));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useUserMe(api));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.hasPickled).toBe(false);

    let refreshed: unknown = null;
    await act(async () => {
      refreshed = await result.current.refresh();
    });
    expect(refreshed).toEqual(updated);
    expect(result.current.data?.hasPickled).toBe(true);
  });

  it('レスポンスが ok でなければ data は null のまま', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useUserMe(api));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });
});
