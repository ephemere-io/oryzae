import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useHelpProgress } from '@/features/shared/help/hooks/use-help-progress';
import { notifyActivity } from '@/lib/activity';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

function createApiStub(): ApiClient & { fetch: ReturnType<typeof vi.fn> } {
  return { baseUrl: '', headers: {}, fetch: vi.fn() };
}

describe('useHelpProgress', () => {
  it('api が無ければ確かめない（null のまま）', () => {
    const { result } = renderHook(() => useHelpProgress(null));
    expect(result.current.firstVisit).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  it('onboardingCompleted=false なら初めての人', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: false }));
    const { result } = renderHook(() => useHelpProgress(api));
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(true);
    });
    expect(api.fetch).toHaveBeenCalledWith('/api/v1/users/me');
  });

  it('onboardingCompleted=true なら初めてではない', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: true }));
    const { result } = renderHook(() => useHelpProgress(api));
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(false);
    });
  });

  it('三歩の進み具合は users/me の旗から読む（欠けていれば「まだ」）', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(
      mockResponse(true, {
        onboardingCompleted: true,
        hasQuestion: true,
        hasEntry: true,
        hasPickled: false,
      }),
    );
    const { result } = renderHook(() => useHelpProgress(api));
    await waitFor(() => {
      expect(result.current.progress).toEqual({
        question: true,
        write: true,
        link: false,
        pickle: false,
        read: false,
      });
    });
  });

  it('旗が欠けた返事は「初めてではない」に倒す（自動で開くのは確かなときだけ）', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, { id: 'u1' }));
    const { result } = renderHook(() => useHelpProgress(api));
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(false);
    });
  });

  it('取れなければ false（勝手に開かない側に倒す）', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(false, { error: 'boom' }));
    const { result } = renderHook(() => useHelpProgress(api));
    // 返事が届いてから state に落ちるまで一拍あるので、値そのものを待つ。
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(false);
    });
    expect(result.current.progress).toBeNull();
    expect(api.fetch).toHaveBeenCalledTimes(1);
  });

  it('何かを成し遂げた合図で取り直す', async () => {
    const api = createApiStub();
    api.fetch
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: true }))
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: true, hasQuestion: true }));
    const { result } = renderHook(() => useHelpProgress(api));
    await waitFor(() => {
      expect(result.current.progress?.question).toBe(false);
    });
    act(() => notifyActivity('question'));
    await waitFor(() => {
      expect(result.current.progress?.question).toBe(true);
    });
    expect(api.fetch).toHaveBeenCalledTimes(2);
  });

  it('markSeen は先に手元を倒してから PATCH する。二度は送らない', async () => {
    const api = createApiStub();
    api.fetch
      .mockResolvedValueOnce(mockResponse(true, { onboardingCompleted: false }))
      .mockResolvedValue(mockResponse(true, { onboardingCompleted: true }));
    const { result } = renderHook(() => useHelpProgress(api));
    await waitFor(() => {
      expect(result.current.firstVisit).toBe(true);
    });
    await act(async () => {
      await result.current.markSeen();
      await result.current.markSeen();
    });
    expect(result.current.firstVisit).toBe(false);
    expect(api.fetch).toHaveBeenNthCalledWith(2, '/api/v1/users/me/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
    expect(api.fetch).toHaveBeenCalledTimes(2);
  });
});
