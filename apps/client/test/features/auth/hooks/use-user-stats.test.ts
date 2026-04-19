import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStats } from '@/features/auth/hooks/use-user-stats';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useUserStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_access_token', 'test-token');
  });

  it('fetches stats on mount', async () => {
    const statsBody = {
      streak: 5,
      totalEntries: 42,
      totalChars: 125000,
      totalFermentations: 15,
      weeklyChars: 3500,
      monthlyChars: 12000,
      entriesByQuestion: [],
      monthlyTrend: [],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, statsBody));

    const { result } = renderHook(() => useUserStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats?.streak).toBe(5);
    expect(result.current.stats?.totalEntries).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useUserStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('統計データの取得に失敗しました');
  });
});
