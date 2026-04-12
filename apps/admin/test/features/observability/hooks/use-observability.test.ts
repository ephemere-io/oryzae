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

  it('fetches summary and merges PostHog metrics from analytics API', async () => {
    const summaryBody = {
      tools: [
        {
          id: 'posthog',
          name: 'PostHog',
          tagline: 'ユーザー行動分析',
          href: '/analytics',
          externalUrl: 'https://us.posthog.com/project/378500',
          metric: null,
        },
      ],
    };
    const analyticsBody = { totalPageviews: 1234, totalSessions: 42 };

    mockFetch
      .mockResolvedValueOnce(mockResponse(true, summaryBody))
      .mockResolvedValueOnce(mockResponse(true, analyticsBody));

    const { result } = renderHook(() => useObservability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tools).toHaveLength(1);
    expect(result.current.tools[0].metric?.value).toBe('1,234');
    expect(result.current.error).toBeNull();
  });

  it('sets error when summary fetch fails', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(false, {}))
      .mockResolvedValueOnce(mockResponse(true, { totalPageviews: 0, totalSessions: 0 }));

    const { result } = renderHook(() => useObservability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('監視データの取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();
    const { result } = renderHook(() => useObservability());
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.tools).toEqual([]);
  });
});
