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

const sampleResponseDays = [
  { date: '2026-04-06', totalFermentations: 20, completedFermentations: 19, activeWriters: 10 },
  { date: '2026-04-07', totalFermentations: 10, completedFermentations: 8, activeWriters: 8 },
];

const expectedDays = [
  {
    date: '2026-04-06',
    totalFermentations: 20,
    completedFermentations: 19,
    activeWriters: 10,
    successRate: 95,
  },
  {
    date: '2026-04-07',
    totalFermentations: 10,
    completedFermentations: 8,
    activeWriters: 8,
    successRate: 80,
  },
];

describe('useHealthTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches trend data on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, { days: sampleResponseDays }));

    const { result } = renderHook(() => useHealthTrends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.days).toEqual(expectedDays);
    expect(result.current.error).toBeNull();
  });

  it('passes dateFrom and dateTo as query parameters', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, { days: sampleResponseDays }));

    renderHook(() => useHealthTrends('2026-04-01', '2026-04-12'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('date_from=2026-04-01');
    expect(calledUrl).toContain('date_to=2026-04-12');
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
