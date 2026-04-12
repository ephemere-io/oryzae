import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUsers } from '@/features/users/hooks/use-users';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches users on mount', async () => {
    const users = [
      {
        id: 'u1',
        email: 'test@test.com',
        createdAt: '2026-04-01',
        lastSignInAt: '2026-04-10',
        entryCount: 5,
        questionCount: 2,
        fermentationTotal: 3,
        fermentationCompleted: 2,
        fermentationFailed: 1,
      },
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(true, { users }));

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].email).toBe('test@test.com');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('ユーザー情報の取得に失敗しました');
  });
});
