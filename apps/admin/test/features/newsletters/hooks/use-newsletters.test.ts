import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewsletters } from '@/features/newsletters/hooks/use-newsletters';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse({ ok, body }: { ok: boolean; body?: unknown }): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body ?? {}),
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
  } as Response;
}

const newsletter = {
  id: 'nl-1',
  subject: '今月の更新',
  bodyMarkdown: '本文',
  status: 'sent',
  createdBy: 'admin-1',
  recipientCount: 200,
  sentCount: 198,
  failedCount: 2,
  lastError: null,
  sentAt: '2026-09-12T00:00:00.000Z',
  createdAt: '2026-09-11T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
};

describe('useNewsletters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('一覧を取得する', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true, body: { data: [newsletter] } }));

    const { result } = renderHook(() => useNewsletters());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/admin/newsletters', expect.anything());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].sentCount).toBe(198);
    expect(result.current.error).toBeNull();
  });

  it('失敗したらエラーを立てる', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: false }));

    const { result } = renderHook(() => useNewsletters());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('ニュースレターの取得に失敗しました');
    expect(result.current.data).toEqual([]);
  });

  it('形が想定と違えばエラー扱いにする（壊れたデータを画面に流さない）', async () => {
    mockFetch.mockResolvedValue(
      mockResponse({ ok: true, body: { data: [{ id: 'nl-1', subject: 1234 }] } }),
    );

    const { result } = renderHook(() => useNewsletters());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toEqual([]);
  });
});
