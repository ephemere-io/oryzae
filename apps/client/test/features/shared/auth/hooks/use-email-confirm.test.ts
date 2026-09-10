import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmailConfirm } from '@/features/shared/auth/hooks/use-email-confirm';

/**
 * Issue #490: `app/(auth)/auth/confirm/page.tsx` の直叩きを共有 hook へ移した分の担保。
 * hook は文言ではなくエラーコードを返し、page が i18n で解決する。
 */
const push = vi.fn();
const assign = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));
vi.mock('posthog-js', () => ({ default: { identify: vi.fn() } }));

function mockFetch(ok: boolean, body: unknown = {}) {
  return vi.fn(() =>
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
    Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response),
  );
}

const session = {
  user: { id: 'u1', email: 'a@example.com' },
  session: { accessToken: 'at', refreshToken: 'rt' },
};

describe('useEmailConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    params = new URLSearchParams();
    // 確定後は読み込み直して入る（window.location.assign）。jsdom の location は
    // 再定義できないので丸ごと差し替える。
    vi.stubGlobal('location', { assign });
  });
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('auth_error が付いていれば auth_failed（通信しない）', async () => {
    // ルート（/）の HomeGate が Supabase の #error=... をここへ回してくる経路。
    // 期限切れリンクの理由をユーザーに見せるための分岐で、通信は一切しない。
    params = new URLSearchParams({ auth_error: 'otp_expired' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useEmailConfirm());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('token_hash / type が無ければ invalid_link（通信しない）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useEmailConfirm());

    await waitFor(() => expect(result.current.error).toBe('invalid_link'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('未知の type は invalid_link', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'unknown' });
    const { result } = renderHook(() => useEmailConfirm());
    await waitFor(() => expect(result.current.error).toBe('invalid_link'));
  });

  it('成功するとトークンを保存し type ごとの既定遷移先へ送る', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'recovery' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));

    renderHook(() => useEmailConfirm());

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/reset-password'));
    expect(localStorage.getItem('oryzae_access_token')).toBe('at');
  });

  it('next があればそちらを優先する', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'signup', next: '/entries/new' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));

    renderHook(() => useEmailConfirm());

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/entries/new'));
  });

  it('検証に失敗したら auth_failed（遷移しない）', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'signup' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(false));

    const { result } = renderHook(() => useEmailConfirm());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('レスポンスの形が壊れていたら auth_failed', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'signup' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, { user: {} }));

    const { result } = renderHook(() => useEmailConfirm());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
  });

  it('session のトークンが文字列でなければ auth_failed（保存も遷移もしない）', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'signup' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockFetch(true, { user: { id: 'u1', email: 'a@example.com' }, session: { accessToken: 1 } }),
    );

    const { result } = renderHook(() => useEmailConfirm());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
    expect(localStorage.getItem('oryzae_access_token')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });
});
