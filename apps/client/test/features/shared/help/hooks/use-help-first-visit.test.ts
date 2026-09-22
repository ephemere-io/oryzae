import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHelpFirstVisit } from '@/features/shared/help/hooks/use-help-first-visit';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

function createApiStub(): ApiClient & { fetch: ReturnType<typeof vi.fn> } {
  return { baseUrl: '', headers: {}, fetch: vi.fn() };
}

describe('useHelpFirstVisit', () => {
  it('api が無ければ確かめない（null のまま）', () => {
    const { result } = renderHook(() => useHelpFirstVisit(null));
    expect(result.current.firstVisit).toBeNull();
  });

  it('onboardingCompleted=false なら初めての人', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: false }));
    const { result } = renderHook(() => useHelpFirstVisit(api));
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(true);
    });
    expect(api.fetch).toHaveBeenCalledWith('/api/v1/users/me');
  });

  it('onboardingCompleted=true なら初めてではない', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: true }));
    const { result } = renderHook(() => useHelpFirstVisit(api));
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(false);
    });
  });

  it('旗が欠けた返事は「初めてではない」に倒す（自動で開くのは確かなときだけ）', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, { id: 'u1' }));
    const { result } = renderHook(() => useHelpFirstVisit(api));
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(false);
    });
  });

  it('取れなければ null のまま', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(false, { error: 'boom' }));
    const { result } = renderHook(() => useHelpFirstVisit(api));
    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledTimes(1);
    });
    expect(result.current.firstVisit).toBeNull();
  });

  it('markSeen は先に手元を倒してから PATCH する', async () => {
    const api = createApiStub();
    api.fetch
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: false }))
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: true }));
    const { result } = renderHook(() => useHelpFirstVisit(api));
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(true);
    });
    await act(async () => {
      await result.current.markSeen();
    });
    expect(result.current.firstVisit).toBe(false);
    expect(api.fetch).toHaveBeenNthCalledWith(2, '/api/v1/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
  });
});
