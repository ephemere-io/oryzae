import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminOAuthRedirectUrl,
  useAdminGoogleLogin,
} from '@/features/auth/hooks/use-admin-google-login';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 403,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const TOKEN_HASH = '#access_token=at&refresh_token=rt&expires_in=3600&token_type=bearer';

describe('useAdminGoogleLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('戻り先は管理画面の /auth/callback', () => {
    expect(adminOAuthRedirectUrl('https://oryzae-admin.vercel.app')).toBe(
      'https://oryzae-admin.vercel.app/auth/callback',
    );
  });

  it('start: 管理画面の戻り先で Google の認可 URL をもらう', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, { url: 'https://accounts.google.com/x' }));
    const { result } = renderHook(() => useAdminGoogleLogin());

    expect(await result.current.startGoogleLogin()).toEqual({
      url: 'https://accounts.google.com/x',
    });
    const [url, init] = mockFetch.mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/v1/auth/oauth/google');
    expect(JSON.parse(String(init?.body))).toEqual({
      redirectTo: `${window.location.origin}/auth/callback`,
    });
  });

  it('start: もらえなければエラー文言', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'x' }));
    const { result } = renderHook(() => useAdminGoogleLogin());

    expect(await result.current.startGoogleLogin()).toEqual({
      error: 'Google ログインを始められませんでした',
    });
  });

  it('complete: 管理者ならトークンを保存する（アプリの新規登録口は叩かない）', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, { totalUsers: 1 }));
    const { result } = renderHook(() => useAdminGoogleLogin());

    expect(await result.current.completeGoogleLogin({ hash: TOKEN_HASH })).toBeNull();
    expect(localStorage.getItem('oryzae_admin_access_token')).toBe('at');
    expect(localStorage.getItem('oryzae_admin_refresh_token')).toBe('rt');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/api/v1/admin/dashboard/stats');
  });

  it('complete: 管理者でなければトークンを残さない', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Admin access required' }));
    const { result } = renderHook(() => useAdminGoogleLogin());

    expect(await result.current.completeGoogleLogin({ hash: TOKEN_HASH })).toBe(
      'このアカウントには管理者権限がありません',
    );
    expect(localStorage.getItem('oryzae_admin_access_token')).toBeNull();
  });

  it('complete: トークンが無い・Google 側のエラーはそのまま伝える', async () => {
    const { result } = renderHook(() => useAdminGoogleLogin());

    expect(await result.current.completeGoogleLogin({ hash: '' })).toBe(
      'Google ログインに失敗しました（トークンを受け取れませんでした）',
    );
    expect(
      await result.current.completeGoogleLogin({
        hash: '#error=access_denied&error_description=denied',
      }),
    ).toBe('Google ログインに失敗しました: denied');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
