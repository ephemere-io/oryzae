import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnalytics } from '@/features/analytics/hooks/use-analytics';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches all analytics data on mount', async () => {
    const overviewBody = {
      totalPageviews: 100,
      totalSessions: 30,
      avgSessionDurationSeconds: 120,
      entryPageViews: 50,
      jarPageViews: 20,
    };
    const pagesBody = {
      data: [{ path: '/entries', views: 50 }],
    };
    const dailyBody = {
      data: [{ date: '2026-04-12', pageviews: 30, uniqueUsers: 10 }],
    };

    mockFetch
      .mockResolvedValueOnce(mockResponse(true, overviewBody))
      .mockResolvedValueOnce(mockResponse(true, pagesBody))
      .mockResolvedValueOnce(mockResponse(true, dailyBody));

    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.overview?.totalPageviews).toBe(100);
    expect(result.current.pages).toHaveLength(1);
    expect(result.current.daily).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(false, {}))
      .mockResolvedValueOnce(mockResponse(true, { data: [] }))
      .mockResolvedValueOnce(mockResponse(true, { data: [] }));

    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('分析データの取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useAnalytics());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.overview).toBeNull();
  });
});
