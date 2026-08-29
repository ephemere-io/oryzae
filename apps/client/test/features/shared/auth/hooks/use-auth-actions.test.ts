import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthActions } from '@/features/shared/auth/hooks/use-auth-actions';
import { textResponse } from '../../../../helpers/response';

/**
 * Issue #490: 認証フォームが直叩きしていた3つの POST を共有 hook に集約した分の担保。
 * 文言は呼び出し側が translateAuthError で解決するため、hook はコードをそのまま返す。
 */
function mockFetch(ok: boolean, body: unknown = {}) {
  return vi.fn(() =>
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
    Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response),
  );
}

describe('useAuthActions', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('requestPasswordReset は email と redirectTo を送る', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true));
    const { result } = renderHook(() => useAuthActions());

    const res = await result.current.requestPasswordReset('a@example.com', 'https://x/reset');

    expect(res).toEqual({ ok: true });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/auth/reset-password');
    expect(init?.body).toBe(
      JSON.stringify({ email: 'a@example.com', redirectTo: 'https://x/reset' }),
    );
  });

  it('updatePassword はトークンと新パスワードを送る', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true));
    const { result } = renderHook(() => useAuthActions());

    await result.current.updatePassword('tok', 'pw');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/auth/update-password');
    expect(init?.body).toBe(JSON.stringify({ accessToken: 'tok', password: 'pw' }));
  });

  it('失敗時はサーバーのエラーコードを返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(false, { error: 'rate_limit' }));
    const { result } = renderHook(() => useAuthActions());

    const res = await result.current.requestPasswordReset('a@example.com', 'https://x');

    expect(res).toEqual({ ok: false, error: 'rate_limit' });
  });

  it('エラー本文が JSON でなくても落ちず空コードを返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      // JSON にならない 500（HTML エラーページ等）を本物の Response で再現する。
      vi.fn(() => Promise.resolve(textResponse('<html>500</html>', 500))),
    );
    const { result } = renderHook(() => useAuthActions());

    const res = await result.current.updatePassword('tok', 'pw');

    expect(res).toEqual({ ok: false, error: '' });
  });

  it('startGoogleOauth は認可 URL を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetch(true, { url: 'https://accounts.google.com/o/oauth2/auth?x=1' }),
    );
    const { result } = renderHook(() => useAuthActions());

    const url = await result.current.startGoogleOauth('https://x/callback', 'ja');

    expect(url).toBe('https://accounts.google.com/o/oauth2/auth?x=1');
  });

  it('startGoogleOauth は url が無い/失敗なら null（呼び出し側は文言を出さない既存挙動）', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, {}));
    const { result } = renderHook(() => useAuthActions());
    expect(await result.current.startGoogleOauth('https://x/callback', 'ja')).toBeNull();

    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(false));
    expect(await result.current.startGoogleOauth('https://x/callback', 'ja')).toBeNull();
  });
});
