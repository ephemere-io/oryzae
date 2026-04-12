import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCostSummary } from '@/features/dashboard/hooks/use-cost-summary';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const sampleSummary = {
  currentMonthCost: 12.5,
  lastMonthCost: 15.3,
  projectedCost: 18.0,
};

describe('useCostSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches cost summary on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleSummary));

    const { result } = renderHook(() => useCostSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toEqual(sampleSummary);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Server Error' }));

    const { result } = renderHook(() => useCostSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBe('コスト情報の取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useCostSummary());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();
  });
});
