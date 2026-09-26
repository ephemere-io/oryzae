import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useErrors } from '@/features/errors/hooks/use-errors';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const okBody = {
  status: 'ok',
  missing: [],
  message: null,
  environment: 'production',
  sending: { server: true, browser: true },
  consoleUrl: 'https://oryzae.sentry.io/issues/',
  issues: [
    {
      id: '1',
      shortId: 'ORYZAE-1',
      title: 'Error: boom',
      culprit: 'GET /api/v1/board',
      level: 'error',
      count: 29,
      userCount: 2,
      firstSeen: '2026-09-23T00:54:27Z',
      lastSeen: '2026-09-23T16:22:31Z',
      permalink: 'https://oryzae.sentry.io/issues/1/',
      isUnhandled: true,
      isNew: false,
    },
  ],
  daily: [{ date: '2026-09-26', events: 3 }],
  truncated: false,
};

describe('useErrors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('loads issues from the errors API', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, okBody));

    const { result } = renderHook(() => useErrors());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/api/v1/admin/errors');
    expect(result.current.data?.issues[0]?.shortId).toBe('ORYZAE-1');
    expect(result.current.error).toBeNull();
  });

  it('keeps the not-configured status so the page does not claim there are no errors', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, {
        ...okBody,
        status: 'not-configured',
        missing: ['SENTRY_AUTH_TOKEN'],
        issues: [],
        daily: [],
      }),
    );

    const { result } = renderHook(() => useErrors());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.status).toBe('not-configured');
    expect(result.current.data?.missing).toEqual(['SENTRY_AUTH_TOKEN']);
  });

  it('sets an error when the request fails', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useErrors());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('エラー情報を取得できませんでした');
    expect(result.current.data).toBeNull();
  });
});
