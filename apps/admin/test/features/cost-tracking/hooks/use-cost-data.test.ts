import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCostData } from '@/features/cost-tracking/hooks/use-cost-data';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useCostData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches cost data on mount', async () => {
    const responseBody = {
      data: [
        {
          id: 'f1',
          user_id: 'u1',
          status: 'completed',
          generation_id: 'gen_123',
          created_at: '2026-04-11T10:00:00Z',
          cost: { totalCost: 0.05, promptTokens: 1000, completionTokens: 500, latency: 2000 },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1 },
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, responseBody));

    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].cost?.totalCost).toBe(0.05);
    expect(result.current.pagination.total).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Server error' }));

    const { result } = renderHook(() => useCostData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe('コストデータの取得に失敗しました');
  });

  it('passes page and limit to API', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, { data: [], pagination: { page: 2, limit: 10, total: 0 } }),
    );

    renderHook(() => useCostData({ page: 2, limit: 10 }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('limit=10');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useCostData());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });
});
