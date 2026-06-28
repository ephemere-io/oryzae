import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserActivity } from '@/features/dashboard/hooks/use-user-activity';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useUserActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches user activity on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, { activeWriters: 5, totalUsers: 20 }));

    const { result } = renderHook(() => useUserActivity());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeWriters).toBe(5);
    expect(result.current.totalUsers).toBe(20);
    expect(result.current.error).toBeNull();
  });

  it('passes date_from and date_to as query parameters', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, { activeWriters: 3, totalUsers: 10 }));

    renderHook(() => useUserActivity('2026-04-01', '2026-04-12'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // サーバー側 (/user-activity) は date_from/date_to (snake_case) を読む。
    // 以前 camelCase で送っていたため期間が常に無視され 7日固定になっていた回帰の防止。
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('date_from=2026-04-01');
    expect(calledUrl).toContain('date_to=2026-04-12');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Server Error' }));

    const { result } = renderHook(() => useUserActivity());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeWriters).toBe(0);
    expect(result.current.totalUsers).toBe(0);
    expect(result.current.error).toBe('ユーザーアクティビティの取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useUserActivity());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.activeWriters).toBe(0);
    expect(result.current.totalUsers).toBe(0);
  });
});
