import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeleteUser } from '@/features/users/hooks/use-delete-user';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

interface MockResponseInit {
  ok: boolean;
  status?: number;
  body?: unknown;
}

function mockResponse({ ok, status, body }: MockResponseInit): Response {
  return {
    ok,
    status: status ?? (ok ? 200 : 400),
    json: () => Promise.resolve(body ?? {}),
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
  } as Response;
}

describe('useDeleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('DELETE /api/v1/admin/users/:id を叩いて成功時は true を返す', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        body: { deleted: { userId: 'u1', email: 'a@b.com' } },
      }),
    );

    const { result } = renderHook(() => useDeleteUser());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteUser('u1');
    });

    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/users/u1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('サーバーのエラーメッセージを拾って表示する', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 400,
        body: { error: 'Admin cannot delete their own account' },
      }),
    );

    const { result } = renderHook(() => useDeleteUser());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteUser('u1');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Admin cannot delete their own account');
  });

  it('レスポンスが JSON でないときはデフォルト文言にフォールバックする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
      // @type-assertion-allowed: テスト用の最小限 Response スタブ
    } as Response);

    const { result } = renderHook(() => useDeleteUser());

    await act(async () => {
      await result.current.deleteUser('u1');
    });

    expect(result.current.error).toBe('ユーザーの削除に失敗しました');
  });

  it('アクセストークンが無いときは fetch を呼ばずに false を返す', async () => {
    localStorage.removeItem('oryzae_admin_access_token');
    const { result } = renderHook(() => useDeleteUser());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteUser('u1');
    });

    expect(ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reset() でエラーをクリアする', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500, body: { error: 'boom' } }),
    );

    const { result } = renderHook(() => useDeleteUser());

    await act(async () => {
      await result.current.deleteUser('u1');
    });
    expect(result.current.error).toBe('boom');

    act(() => {
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
  });
});
