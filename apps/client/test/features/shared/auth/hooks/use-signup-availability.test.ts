import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignupAvailability } from '@/features/shared/auth/hooks/use-signup-availability';
import { jsonResponse } from '../../../../helpers/response';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown, status = ok ? 200 : 500): Response {
  return jsonResponse(body, status);
}

describe('useSignupAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('マウント時にフェッチして availability をセットする', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        limit: 100,
        used: 42,
        remaining: 58,
        capacityReached: false,
      }),
    );

    const { result } = renderHook(() => useSignupAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.availability).toEqual({
      limit: 100,
      used: 42,
      remaining: 58,
      capacityReached: false,
    });
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/signup/availability');
  });

  it('上限到達時も availability を返す (capacityReached=true)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        limit: 100,
        used: 100,
        remaining: 0,
        capacityReached: true,
      }),
    );

    const { result } = renderHook(() => useSignupAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.availability?.capacityReached).toBe(true);
    expect(result.current.availability?.remaining).toBe(0);
  });

  it('HTTP エラー時は error をセットする', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}, 500));

    const { result } = renderHook(() => useSignupAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.availability).toBeNull();
    expect(result.current.error).toContain('500');
  });

  it('fetch の throw 時にも error をセットする', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useSignupAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('network down');
  });

  it('必須の数値が欠けた応答は availability に入れずエラーにする', async () => {
    // エラーエンベロープ。以前はゼロ埋めされて「残り 0 枠だが満員ではない」という
    // 矛盾した状態が本物のデータとして描画されていた。
    mockFetch.mockResolvedValueOnce(mockResponse(true, { error: 'internal' }));

    const { result } = renderHook(() => useSignupAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.availability).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('capacityReached が省略されていても remaining と矛盾しない', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, { limit: 100, used: 100, remaining: 0 }));

    const { result } = renderHook(() => useSignupAvailability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.availability?.capacityReached).toBe(true);
  });
});
