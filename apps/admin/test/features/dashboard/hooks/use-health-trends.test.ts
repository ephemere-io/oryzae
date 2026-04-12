import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHealthTrends } from '@/features/dashboard/hooks/use-health-trends';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const sampleDays = [
  { date: '2026-04-06', successRate: 95, activeWriters: 10 },
  { date: '2026-04-07', successRate: 80, activeWriters: 8 },
];

describe('useHealthTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches trend data on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleDays));

    const { result } = renderHook(() => useHealthTrends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.days).toEqual(sampleDays);
    expect(result.current.error).toBeNull();
  });

  it('passes dateFrom and dateTo as query parameters', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleDays));

    renderHook(() => useHealthTrends('2026-04-01', '2026-04-12'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('dateFrom=2026-04-01');
    expect(calledUrl).toContain('dateTo=2026-04-12');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Server Error' }));

    const { result } = renderHook(() => useHealthTrends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.days).toEqual([]);
    expect(result.current.error).toBe('トレンドデータの取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useHealthTrends());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.days).toEqual([]);
  });
});
