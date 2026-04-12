import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserCostSummary } from '@/features/cost-tracking/hooks/use-user-cost-summary';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useUserCostSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches user cost summary on mount', async () => {
    const responseBody = {
      data: [{ userId: 'u1', email: 'user@test.com', fermentationCount: 5, totalCostUsd: 0.25 }],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, responseBody));

    const { result } = renderHook(() => useUserCostSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].totalCostUsd).toBe(0.25);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Server error' }));

    const { result } = renderHook(() => useUserCostSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('ユーザー別コストの取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useUserCostSummary());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });
});
