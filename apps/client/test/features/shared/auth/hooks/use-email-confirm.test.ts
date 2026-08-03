import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmailConfirm } from '@/features/shared/auth/hooks/use-email-confirm';

/**
 * Issue #490: `app/(auth)/auth/confirm/page.tsx` の直叩きを共有 hook へ移した分の担保。
 * hook は文言ではなくエラーコードを返し、page が i18n で解決する。
 */
const push = vi.fn();
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
  });
  afterEach(() => localStorage.clear());

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

    await waitFor(() => expect(push).toHaveBeenCalledWith('/reset-password'));
    expect(localStorage.getItem('oryzae_access_token')).toBe('at');
  });

  it('next があればそちらを優先する', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'signup', next: '/entries/new' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, session));

    renderHook(() => useEmailConfirm());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/entries/new'));
  });

  it('検証に失敗したら auth_failed（遷移しない）', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'signup' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(false));

    const { result } = renderHook(() => useEmailConfirm());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
    expect(push).not.toHaveBeenCalled();
  });

  it('レスポンスの形が壊れていたら auth_failed', async () => {
    params = new URLSearchParams({ token_hash: 'th', type: 'signup' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true, { user: {} }));

    const { result } = renderHook(() => useEmailConfirm());

    await waitFor(() => expect(result.current.error).toBe('auth_failed'));
  });
});
