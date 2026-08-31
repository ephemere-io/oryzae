import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpend } from '@/features/observability/hooks/use-spend';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const sampleSpend = {
  rangeDays: 30,
  actual: {
    status: 'ok',
    totalCostUsd: 1.23,
    daily: [{ date: '2026-08-08', costUsd: 1.23 }],
    truncated: false,
    message: null,
  },
  estimated: {
    status: 'ok',
    totalCostUsd: 1.19,
    inputTokens: 300000,
    outputTokens: 40000,
    fermentationCount: 12,
    untrackedCount: 1,
    truncated: false,
    daily: [
      {
        date: '2026-08-08',
        estimatedCostUsd: 1.19,
        inputTokens: 300000,
        outputTokens: 40000,
        fermentationCount: 12,
      },
    ],
    byUser: [
      {
        userId: 'u1',
        email: 'user@test.com',
        estimatedCostUsd: 1.19,
        inputTokens: 300000,
        outputTokens: 40000,
        fermentationCount: 12,
      },
    ],
  },
};

describe('useSpend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches actual and estimated spend on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleSpend));

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.actual.status).toBe('ok');
    expect(result.current.data?.actual.totalCostUsd).toBe(1.23);
    expect(result.current.data?.estimated.totalCostUsd).toBe(1.19);
    expect(result.current.data?.estimated.byUser).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('passes the requested range to the API', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleSpend));

    renderHook(() => useSpend(7));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(String(mockFetch.mock.calls[0][0])).toContain('date_from=7');
  });

  it('keeps the not-configured status instead of coercing it to zero', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        ...sampleSpend,
        actual: {
          status: 'not-configured',
          totalCostUsd: null,
          daily: [],
          truncated: false,
          message: null,
        },
      }),
    );

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.actual.status).toBe('not-configured');
    expect(result.current.data?.actual.totalCostUsd).toBeNull();
  });

  it('keeps the truncated flag so a partial actual cost is not shown as complete', async () => {
    // 打ち切りが落ちると SpendView の乖離率ガードが無言で効かなくなり、
    // 「推定が過大」に見えるだけの誤情報が復活する。
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        ...sampleSpend,
        actual: { ...sampleSpend.actual, truncated: true },
      }),
    );

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.actual.truncated).toBe(true);
  });

  it('sets error on a failed response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Server error' }));

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('コストデータの取得に失敗しました');
  });

  it('clears loading when fetch rejects', async () => {
    // finally が無いと loading が true のまま固着する（回帰防止）
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useSpend(30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('コストデータの取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useSpend(30));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
