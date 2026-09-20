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
 * 成功パスは**アプリ内遷移**で終わる（`adoptSession` が認証を文脈に載せるので、読み込み
 * 直す必要が無い）。ここでは「認証を載せたか」「どこへ移したか」で担保する。保留中の継続が
 * テスト終了後に走ると環境破棄後に window を触ってしまうため、各テストの最後で流し切る。
 */
async function flushPending(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

const { push, adoptSession } = vi.hoisted(() => ({
  push: vi.fn(),
  adoptSession: vi.fn(() => true),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => params,
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ adoptSession }) }));
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
    adoptSession.mockReturnValue(true);
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
    await waitFor(() => expect(adoptSession).toHaveBeenCalledWith(session));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
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

  it('PKCE: session を欠くレスポンスは auth_failed（画面を固まらせない）', async () => {
    params = new URLSearchParams({ code: 'c1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetch(true, { user: { id: 'u1', email: 'a@example.com' } }),
    );

    const { result } = renderHook(() => useOauthCallback());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
    expect(adoptSession).not.toHaveBeenCalled();
  });

  it('PKCE: session のトークンが文字列でなければ auth_failed', async () => {
    params = new URLSearchParams({ code: 'c1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetch(true, { user: { id: 'u1', email: 'a@example.com' }, session: { accessToken: 1 } }),
    );

    const { result } = renderHook(() => useOauthCallback());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
    expect(adoptSession).not.toHaveBeenCalled();
  });

  it('implicit: session が無くてもハッシュのトークンで完了する（finalize は user だけ返す）', async () => {
    window.location.hash = '#access_token=at2&refresh_token=rt2';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(mockFetch(true, { user: { id: 'u1', email: 'a@example.com' } }));

    const { result } = renderHook(() => useOauthCallback());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(result.current.error).toBeNull();
    // hash から来たトークンを添えて載せる（応答に session が無いため）。
    await waitFor(() =>
      expect(adoptSession).toHaveBeenCalledWith(
        { user: { id: 'u1', email: 'a@example.com' } },
        { accessToken: 'at2', refreshToken: 'rt2' },
      ),
    );
    await flushPending();
  });

  it('implicit: hash のトークンを保存し /oauth/finalize を撃つ（#307 の profile 作成）', async () => {
    window.location.hash = '#access_token=at2&refresh_token=rt2';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));

    renderHook(() => useOauthCallback());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/v1/auth/oauth/finalize');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
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
  it('確定したら、移る前に beforeLeave（扉を開けて入る）を / で待つ', async () => {
    params = new URLSearchParams({ code: 'c1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));
    // 解決させずに止めておく。止まっている間は行き先へ移らない。
    const beforeLeave = vi.fn(() => new Promise<void>(() => {}));

    renderHook(() => useOauthCallback(beforeLeave));

    await waitFor(() => expect(beforeLeave).toHaveBeenCalledWith('/'));
    expect(adoptSession).toHaveBeenCalledWith(session);
    expect(push).not.toHaveBeenCalled();
  });

  it('文脈に載せられなければ、読み込み直して復元に任せる', async () => {
    // 応答の形が違って載せられないとき。アプリ内遷移だと「未ログイン」に見えて
    // ログイン画面へ弾かれるので、その場合だけ従来どおり読み込み直す。
    params = new URLSearchParams({ code: 'c1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));
    adoptSession.mockReturnValue(false);
    const beforeLeave = vi.fn(() => Promise.resolve());

    renderHook(() => useOauthCallback(beforeLeave));

    await waitFor(() => expect(beforeLeave).toHaveBeenCalledWith('/'));
    await flushPending();
    expect(push).not.toHaveBeenCalled();
  });

  it('通らなかったら beforeLeave を呼ばない（扉は開かない）', async () => {
    params = new URLSearchParams({ code: 'c1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(false, {}, 400));
    const beforeLeave = vi.fn(() => Promise.resolve());

    const { result } = renderHook(() => useOauthCallback(beforeLeave));

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
    expect(beforeLeave).not.toHaveBeenCalled();
  });
});
