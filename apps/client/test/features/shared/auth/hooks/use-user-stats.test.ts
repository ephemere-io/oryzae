import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStats } from '@/features/shared/auth/hooks/use-user-stats';
import { I18nWrapper } from '../../../../helpers/i18n-wrapper';
// 最小限のスタブ（`{ ok, json } as Response`）をやめて本物を組む。api client は
// `headers` と `clone()` を使う（同じ GET を短いあいだ憶えるため）ので、
// 欠けたスタブでは実物と挙動がずれる。helpers/response.ts の注記も参照。
import { jsonResponse } from '../../../../helpers/response';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return jsonResponse(body, ok ? 200 : 500);
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

    const { result } = renderHook(() => useUserStats(), { wrapper: I18nWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats?.streak).toBe(5);
    expect(result.current.stats?.totalEntries).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useUserStats(), { wrapper: I18nWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('統計データの取得に失敗しました');
  });

  it('中核の集計値が欠けた応答は stats に入れずエラーにする', async () => {
    // エラーエンベロープが「全部 0 の統計」として描画されるのを防ぐ。
    mockFetch.mockResolvedValueOnce(mockResponse(true, { error: 'internal' }));

    const { result } = renderHook(() => useUserStats(), { wrapper: I18nWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
