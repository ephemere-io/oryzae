import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOauthCallback } from '@/features/shared/auth/hooks/use-oauth-callback';

/**
 * Issue #490: `app/(auth)/callback/page.tsx` の直叩きを共有 hook へ移した分の担保。
 * PKCE（code クエリ）と implicit（URL ハッシュ）の2フロー、および
 * 409 capacity_reached の区別を固定する。
 */
let params = new URLSearchParams();

/**
 * 成功パスは window.location.assign によるフルページ遷移で終わる。jsdom は実遷移できず
 * location.assign も差し替え不可（non-configurable）なので、遷移そのものは検証せず
 * 「トークン保存まで到達したか」で担保する。保留中の継続がテスト終了後に走ると
 * 環境破棄後に window を触ってしまうため、各テストの最後で明示的に流し切る。
 */
async function flushPending(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => params,
}));
vi.mock('posthog-js', () => ({ default: { identify: vi.fn() } }));

function mockFetch(ok: boolean, body: unknown = {}, status = ok ? 200 : 400) {
  return vi.fn(() =>
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
    Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response),
  );
}

const session = {
  user: { id: 'u1', email: 'a@example.com' },
  session: { accessToken: 'at', refreshToken: 'rt' },
};

describe('useOauthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    params = new URLSearchParams();
    window.location.hash = '';
  });
  afterEach(() => {
    localStorage.clear();
    window.location.hash = '';
  });

  it('code も hash も無ければ no_code（通信しない）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useOauthCallback());

    await waitFor(() => expect(result.current.error).toBe('no_code'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('PKCE: code を /oauth/callback に渡し locale を伝搬する', async () => {
    params = new URLSearchParams({ code: 'c1', locale: 'en' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));

    renderHook(() => useOauthCallback());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/auth/oauth/callback');
    expect(init?.body).toBe(JSON.stringify({ code: 'c1', locale: 'en' }));
    await waitFor(() => expect(localStorage.getItem('oryzae_access_token')).toBe('at'));
    await flushPending();
  });

  it('未対応の locale は送らない（undefined になる）', async () => {
    params = new URLSearchParams({ code: 'c1', locale: 'fr' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));

    renderHook(() => useOauthCallback());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][1]?.body).toBe(JSON.stringify({ code: 'c1' }));
    await flushPending();
  });

  it('409 capacity_reached は専用コードで返す（登録枠満了）', async () => {
    params = new URLSearchParams({ code: 'c1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetch(false, { error: 'capacity_reached' }, 409),
    );

    const { result } = renderHook(() => useOauthCallback());

    await waitFor(() => expect(result.current.error).toBe('capacity_reached'));
  });

  it('それ以外の失敗は auth_failed', async () => {
    params = new URLSearchParams({ code: 'c1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(false, { error: 'boom' }, 500));

    const { result } = renderHook(() => useOauthCallback());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
  });

  it('implicit: hash のトークンを保存し /oauth/finalize を撃つ（#307 の profile 作成）', async () => {
    window.location.hash = '#access_token=at2&refresh_token=rt2';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));

    renderHook(() => useOauthCallback());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/v1/auth/oauth/finalize');
    expect(localStorage.getItem('oryzae_access_token')).toBe('at2');
    await flushPending();
  });

  it('implicit の finalize が 409 なら capacity_reached', async () => {
    window.location.hash = '#access_token=at2&refresh_token=rt2';
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetch(false, { error: 'capacity_reached' }, 409),
    );

    const { result } = renderHook(() => useOauthCallback());

    await waitFor(() => expect(result.current.error).toBe('capacity_reached'));
  });
});
