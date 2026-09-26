import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolsSummary } from '@/features/tools/hooks/use-tools-summary';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const summaryBody = {
  env: {
    sentry: [
      { name: 'SENTRY_DSN', set: false },
      { name: 'SENTRY_AUTH_TOKEN', set: true },
    ],
  },
  sentry: { status: 'ok', unresolvedCount: 3 },
  anthropic: { status: 'ok', monthlySpend: 1.5, message: null },
  resend: { sentCount7d: 12, bouncedCount7d: 1 },
  upstash: { totalKeys: 42 },
  vercel: { latestDeployState: 'READY' },
};

describe('useToolsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches the tools summary and merges PostHog data', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(true, summaryBody))
      .mockResolvedValueOnce(mockResponse(true, { totalPageviews: 1234, totalSessions: 42 }));

    const { result } = renderHook(() => useToolsSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/api/v1/admin/tools/summary');
    expect(result.current.data?.posthog?.totalPageviews).toBe(1234);
    expect(result.current.data?.sentry).toEqual({ status: 'ok', unresolvedCount: 3 });
    expect(result.current.data?.env.sentry).toEqual([
      { name: 'SENTRY_DSN', set: false },
      { name: 'SENTRY_AUTH_TOKEN', set: true },
    ]);
    expect(result.current.data?.anthropic.monthlySpend).toBe(1.5);
    expect(result.current.error).toBeNull();
  });

  it('keeps the summary when PostHog is unavailable', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(true, summaryBody))
      .mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useToolsSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.posthog).toBeNull();
    expect(result.current.data?.vercel.latestDeployState).toBe('READY');
  });

  it('sets error when summary fails', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(false, {}))
      .mockResolvedValueOnce(mockResponse(true, {}));

    const { result } = renderHook(() => useToolsSummary());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('ツールの状態を取得できませんでした');
  });

  it('does nothing when no token', async () => {
    localStorage.clear();
    const { result } = renderHook(() => useToolsSummary());
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
