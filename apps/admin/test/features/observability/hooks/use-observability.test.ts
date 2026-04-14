import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useObservability } from '@/features/observability/hooks/use-observability';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useObservability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches summary and merges PostHog data', async () => {
    const summaryBody = {
      sentry: { unresolvedCount: 3 },
      gateway: { monthlySpend: 1.5, monthlyRequests: 10, creditBalance: '8.5', creditUsed: '1.5' },
      upstash: { totalKeys: 42 },
      vercel: { latestDeployState: 'READY' },
    };
    const analyticsBody = { totalPageviews: 1234, totalSessions: 42 };

    mockFetch
      .mockResolvedValueOnce(mockResponse(true, summaryBody))
      .mockResolvedValueOnce(mockResponse(true, analyticsBody));

    const { result } = renderHook(() => useObservability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.posthog?.totalPageviews).toBe(1234);
    expect(result.current.data?.sentry.unresolvedCount).toBe(3);
    expect(result.current.data?.gateway.monthlySpend).toBe(1.5);
    expect(result.current.error).toBeNull();
  });

  it('sets error when summary fails', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(false, {}))
      .mockResolvedValueOnce(mockResponse(true, {}));

    const { result } = renderHook(() => useObservability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('監視データの取得に失敗しました');
  });

  it('does nothing when no token', async () => {
    localStorage.clear();
    const { result } = renderHook(() => useObservability());
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
