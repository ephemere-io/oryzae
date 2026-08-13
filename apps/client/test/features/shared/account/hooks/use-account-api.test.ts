import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountApi } from '@/features/shared/account/hooks/use-account-api';

/**
 * Issue #490: PC / SP のアカウント画面が同じ profile 更新を別実装で持っていたのを1本化した
 * 共有 hook。文言は端末側で出し分けるため、hook は翻訳済み文字列ではなく理由（kind）を返す。
 */
const TOKEN_KEY = 'oryzae_access_token';

function mockFetch(ok: boolean, body: unknown = {}) {
  return vi.fn(() =>
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
    Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response),
  );
}

describe('useAccountApi', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('トークンが無ければ通信せず unauthenticated を返す', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useAccountApi());

    const res = await result.current.updateProfile('nickname', 'ゆき');

    expect(res).toEqual({ ok: false, kind: 'unauthenticated' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('プロフィール更新は PATCH /api/v1/auth/profile を撃つ', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true));
    const { result } = renderHook(() => useAccountApi());

    const res = await result.current.updateProfile('nickname', 'ゆき');

    expect(res).toEqual({ ok: true });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/auth/profile');
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe(JSON.stringify({ nickname: 'ゆき' }));
  });

  it('メール変更は POST /api/v1/auth/change-email を撃つ', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true));
    const { result } = renderHook(() => useAccountApi());

    await result.current.changeEmail('new@example.com');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/auth/change-email');
    expect(init?.method).toBe('POST');
  });

  it('パスワード変更は POST /api/v1/auth/change-password を撃つ', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(true));
    const { result } = renderHook(() => useAccountApi());

    await result.current.changePassword('old', 'new');

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/auth/change-password');
    expect(init?.body).toBe(JSON.stringify({ currentPassword: 'old', newPassword: 'new' }));
  });

  it('サーバーエラーは kind=server とエラーコードを返す', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(false, { error: 'email_taken' }));
    const { result } = renderHook(() => useAccountApi());

    const res = await result.current.changeEmail('taken@example.com');

    expect(res).toEqual({ ok: false, kind: 'server', error: 'email_taken' });
  });

  it('エラー本文が壊れていても error は空文字で落ちない', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    vi.spyOn(globalThis, 'fetch').mockImplementation(mockFetch(false, null));
    const { result } = renderHook(() => useAccountApi());

    const res = await result.current.updateProfile('nickname', 'x');

    expect(res).toEqual({ ok: false, kind: 'server', error: '' });
  });
});
