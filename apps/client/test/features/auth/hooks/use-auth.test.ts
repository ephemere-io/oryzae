import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/features/auth/hooks/use-auth';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 400,
  } as Response;
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('login returns null on success and stores tokens', async () => {
    const session = { accessToken: 'at', refreshToken: 'rt' };
    const user = {
      id: 'u1',
      email: 'a@b.com',
      nickname: 'testuser',
      avatarUrl: 'https://example.com/avatar.jpg',
      name: 'Test User',
      providers: ['email'],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, { user, session }));

    const { result } = renderHook(() => useAuth());

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('a@b.com', 'pass');
    });

    expect(loginResult).toBeNull();
    expect(localStorage.getItem('oryzae_access_token')).toBe('at');
    expect(localStorage.getItem('oryzae_refresh_token')).toBe('rt');
    expect(result.current.auth?.user.email).toBe('a@b.com');
  });

  it('login returns error string on failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Invalid credentials' }));

    const { result } = renderHook(() => useAuth());

    let loginResult: string | null = null;
    await act(async () => {
      loginResult = await result.current.login('a@b.com', 'wrong');
    });

    expect(loginResult).toBe('Invalid credentials');
    expect(result.current.auth).toBeNull();
  });

  it('signup returns null on success and stores tokens', async () => {
    const session = { accessToken: 'at2', refreshToken: 'rt2' };
    const user = {
      id: 'u2',
      email: 'b@c.com',
      nickname: 'newuser',
      avatarUrl: null,
      name: null,
      providers: ['email'],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, { user, session }));

    const { result } = renderHook(() => useAuth());

    let signupResult: string | null = null;
    await act(async () => {
      signupResult = await result.current.signup('testuser', 'b@c.com', 'pass');
    });

    expect(signupResult).toBeNull();
    expect(localStorage.getItem('oryzae_access_token')).toBe('at2');
    expect(localStorage.getItem('oryzae_refresh_token')).toBe('rt2');
    expect(result.current.auth?.user.email).toBe('b@c.com');
  });

  it('signup returns error string on failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Email taken' }));

    const { result } = renderHook(() => useAuth());

    let signupResult: string | null = null;
    await act(async () => {
      signupResult = await result.current.signup('testuser', 'b@c.com', 'pass');
    });

    expect(signupResult).toBe('Email taken');
    expect(result.current.auth).toBeNull();
  });

  it('logout clears tokens and resets state', async () => {
    const session = { accessToken: 'at', refreshToken: 'rt' };
    const user = {
      id: 'u1',
      email: 'a@b.com',
      nickname: 'testuser',
      avatarUrl: 'https://example.com/avatar.jpg',
      name: 'Test User',
      providers: ['email'],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, { user, session }));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('a@b.com', 'pass');
    });

    expect(result.current.auth).not.toBeNull();

    act(() => {
      result.current.logout();
    });

    expect(result.current.auth).toBeNull();
    expect(result.current.api).toBeNull();
    expect(localStorage.getItem('oryzae_access_token')).toBeNull();
    expect(localStorage.getItem('oryzae_refresh_token')).toBeNull();
  });

  it('initial load with valid token sets auth state', async () => {
    localStorage.setItem('oryzae_access_token', 'existing-token');

    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        user: {
          id: 'u1',
          email: 'a@b.com',
          nickname: 'testuser',
          avatarUrl: 'https://example.com/avatar.jpg',
          name: 'Test User',
          providers: ['email'],
        },
      }),
    );

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.auth?.user.email).toBe('a@b.com');
    expect(result.current.api).not.toBeNull();
  });

  it('initial load with invalid token clears tokens', async () => {
    localStorage.setItem('oryzae_access_token', 'bad-token');

    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.auth).toBeNull();
    expect(localStorage.getItem('oryzae_access_token')).toBeNull();
  });
});
