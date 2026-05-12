import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnboarding } from '@/features/onboarding/hooks/use-onboarding';
import type { ApiClient } from '@/lib/api';

function mockResponse(ok: boolean, body: unknown): Response {
  // @type-assertion-allowed: minimal Response stub for test
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response;
}

function createApiStub(): ApiClient & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn();
  return {
    baseUrl: '',
    headers: {},
    fetch,
  };
}

describe('useOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('api が null のときは何もしない', () => {
    const { result } = renderHook(() => useOnboarding(null));
    expect(result.current.shouldShow).toBe(false);
  });

  it('onboardingCompleted=false のとき shouldShow が true になる', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: false }));

    const { result } = renderHook(() => useOnboarding(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shouldShow).toBe(true);
    expect(api.fetch).toHaveBeenCalledWith('/api/v1/users/me');
  });

  it('onboardingCompleted=true のとき shouldShow が false のまま', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: true }));

    const { result } = renderHook(() => useOnboarding(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.shouldShow).toBe(false);
  });

  it('complete は firstQuestion がある場合 POST /questions と PATCH /onboarding を呼ぶ', async () => {
    const api = createApiStub();
    api.fetch
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: false }))
      .mockResolvedValueOnce(mockResponse(true, { id: 'new-q-id' }))
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: true }));

    const { result } = renderHook(() => useOnboarding(api));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let completeResult: { questionId: string | null } | undefined;
    await act(async () => {
      completeResult = await result.current.complete({ firstQuestion: 'なぜ?' });
    });

    expect(api.fetch).toHaveBeenNthCalledWith(2, '/api/v1/questions', {
      method: 'POST',
      body: JSON.stringify({ string: 'なぜ?' }),
    });
    expect(api.fetch).toHaveBeenNthCalledWith(3, '/api/v1/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
    expect(result.current.shouldShow).toBe(false);
    expect(completeResult).toEqual({ questionId: 'new-q-id' });
  });

  it('complete は firstQuestion が null のとき POST /questions を呼ばない', async () => {
    const api = createApiStub();
    api.fetch
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: false }))
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: true }));

    const { result } = renderHook(() => useOnboarding(api));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let completeResult: { questionId: string | null } | undefined;
    await act(async () => {
      completeResult = await result.current.complete({ firstQuestion: null });
    });

    expect(api.fetch).toHaveBeenCalledTimes(2);
    expect(api.fetch).toHaveBeenNthCalledWith(2, '/api/v1/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
    expect(completeResult).toEqual({ questionId: null });
  });

  it('complete は POST /questions が失敗した場合でも PATCH を続行し questionId は null', async () => {
    const api = createApiStub();
    api.fetch
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: false }))
      .mockResolvedValueOnce(mockResponse(false, { error: 'boom' }))
      .mockResolvedValueOnce(mockResponse(true, {}));

    const { result } = renderHook(() => useOnboarding(api));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let completeResult: { questionId: string | null } | undefined;
    await act(async () => {
      completeResult = await result.current.complete({ firstQuestion: 'なぜ?' });
    });

    expect(completeResult).toEqual({ questionId: null });
    expect(api.fetch).toHaveBeenNthCalledWith(3, '/api/v1/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
  });
});
