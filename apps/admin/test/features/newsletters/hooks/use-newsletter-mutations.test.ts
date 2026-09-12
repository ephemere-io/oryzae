import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNewsletterMutations } from '@/features/newsletters/hooks/use-newsletter-mutations';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse({
  ok,
  status,
  body,
}: {
  ok: boolean;
  status?: number;
  body?: unknown;
}): Response {
  return {
    ok,
    status: status ?? (ok ? 200 : 400),
    json: () => Promise.resolve(body ?? {}),
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
  } as Response;
}

const draft = {
  id: 'nl-1',
  subject: '今月の更新',
  bodyMarkdown: '本文',
  status: 'draft',
  createdBy: 'admin-1',
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  lastError: null,
  sentAt: null,
  createdAt: '2026-09-11T00:00:00.000Z',
  updatedAt: '2026-09-11T00:00:00.000Z',
};

describe('useNewsletterMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('create は POST して保存された下書きを返す', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true, status: 201, body: { data: draft } }));

    const { result } = renderHook(() => useNewsletterMutations());
    let created: Awaited<ReturnType<typeof result.current.create>> = null;
    await act(async () => {
      created = await result.current.create({ subject: '今月の更新', bodyMarkdown: '本文' });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/newsletters',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ subject: '今月の更新', bodyMarkdown: '本文' }),
      }),
    );
    expect(created).toMatchObject({ id: 'nl-1', status: 'draft' });
  });

  it('update は PUT する', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true, body: { data: draft } }));

    const { result } = renderHook(() => useNewsletterMutations());
    await act(async () => {
      await result.current.update('nl-1', { subject: '差し替え', bodyMarkdown: '新本文' });
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/newsletters/nl-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('remove は DELETE し、成功したら true', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true, body: { data: { id: 'nl-1' } } }));

    const { result } = renderHook(() => useNewsletterMutations());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.remove('nl-1');
    });

    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/newsletters/nl-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('generateDraft は下書きと素材にした PR を返す', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 201,
        body: {
          newsletter: draft,
          source: {
            since: '2026-08-01T00:00:00.000Z',
            pullRequestCount: 2,
            pullRequests: [
              { number: 601, title: 'feat: x', url: 'https://example.com/601' },
              { number: 602, title: 'fix: y', url: 'https://example.com/602' },
            ],
          },
        },
      }),
    );

    const { result } = renderHook(() => useNewsletterMutations());
    let generated: Awaited<ReturnType<typeof result.current.generateDraft>> = null;
    await act(async () => {
      generated = await result.current.generateDraft();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/newsletters/generate-draft',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(generated).toMatchObject({ source: { pullRequestCount: 2 } });
  });

  it('サーバーのエラー文言をそのまま出す（設定漏れの理由が画面で分かる）', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 400,
        body: { error: 'GITHUB_TOKEN が未設定です。' },
      }),
    );

    const { result } = renderHook(() => useNewsletterMutations());
    await act(async () => {
      await result.current.generateDraft();
    });

    expect(result.current.error).toContain('GITHUB_TOKEN');
  });

  it('resetError でエラーを消せる（別の下書きを開いたときに持ち越さない）', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: false, status: 400 }));

    const { result } = renderHook(() => useNewsletterMutations());
    await act(async () => {
      await result.current.create({ subject: 'x', bodyMarkdown: 'y' });
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.resetError();
    });
    expect(result.current.error).toBeNull();
  });
});
