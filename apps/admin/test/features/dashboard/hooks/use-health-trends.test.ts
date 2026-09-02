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

    expect(result.current.days).toEqual([
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
    ]);
    expect(result.current.error).toBeNull();
  });

  it('reports successRate as null on days with no fermentations', async () => {
    // 0 件の日を 0% にすると「全部失敗した日」と区別が付かず、ダッシュボードが
    // 障害に見えてしまう（赤い目標ラインの下に落ちる）。null で「データなし」を表す
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        days: [
          {
            date: '2026-04-06',
            totalFermentations: 0,
            completedFermentations: 0,
            activeWriters: 3,
          },
          {
            date: '2026-04-07',
            totalFermentations: 4,
            completedFermentations: 0,
            activeWriters: 5,
          },
        ],
      }),
    );

    const { result } = renderHook(() => useHealthTrends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.days[0].successRate).toBeNull();
    // 実際に全部失敗した日は 0（null ではない）
    expect(result.current.days[1].successRate).toBe(0);
  });

  it('passes date_from and date_to as query parameters', async () => {
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
