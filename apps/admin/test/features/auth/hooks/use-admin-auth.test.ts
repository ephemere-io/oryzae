import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminAuth } from '@/features/auth/hooks/use-admin-auth';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 400,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useAdminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('resolves to loading false and auth null when no token stored', async () => {
    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.auth).toBeNull();
    expect(result.current.api).toBeNull();
  });

  it('login returns null on success and stores tokens', async () => {
    const session = { accessToken: 'at', refreshToken: 'rt' };
    const user = { id: 'u1', email: 'admin@test.com' };

    // 1st call: login
    mockFetch.mockResolvedValueOnce(mockResponse(true, { user, session }));
    // 2nd call: admin verification
    mockFetch.mockResolvedValueOnce(mockResponse(true, { totalUsers: 1 }));

    const { result } = renderHook(() => useAdminAuth());

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('admin@test.com', 'pass');
    });

    expect(loginResult).toBeNull();
    expect(localStorage.getItem('oryzae_admin_access_token')).toBe('at');
    expect(result.current.auth?.user.email).toBe('admin@test.com');
  });

  it('login returns error when credentials are wrong', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Invalid credentials' }));

    const { result } = renderHook(() => useAdminAuth());

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('a@b.com', 'wrong');
    });

    expect(loginResult).toBe('Invalid credentials');
    expect(result.current.auth).toBeNull();
  });

  it('login returns error when user is not admin', async () => {
    const session = { accessToken: 'at', refreshToken: 'rt' };
    const user = { id: 'u1', email: 'user@test.com' };

    // Login succeeds
    mockFetch.mockResolvedValueOnce(mockResponse(true, { user, session }));
    // But admin verification fails (403)
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Admin access required' }));

    const { result } = renderHook(() => useAdminAuth());

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('user@test.com', 'pass');
    });

    expect(loginResult).toBe('管理者権限がありません');
    expect(result.current.auth).toBeNull();
  });

  it('logout clears auth and tokens', async () => {
    const session = { accessToken: 'at', refreshToken: 'rt' };
    const user = { id: 'u1', email: 'admin@test.com' };

    mockFetch.mockResolvedValueOnce(mockResponse(true, { user, session }));
    mockFetch.mockResolvedValueOnce(mockResponse(true, { totalUsers: 1 }));

    const { result } = renderHook(() => useAdminAuth());

    await act(async () => {
      await result.current.login('admin@test.com', 'pass');
    });

    expect(result.current.auth).not.toBeNull();

    act(() => {
      result.current.logout();
    });

    expect(result.current.auth).toBeNull();
    expect(localStorage.getItem('oryzae_admin_access_token')).toBeNull();
  });
});
