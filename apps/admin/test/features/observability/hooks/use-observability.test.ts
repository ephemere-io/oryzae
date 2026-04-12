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

  it('fetches tool status on mount', async () => {
    const responseBody = {
      tools: [
        {
          id: 'posthog',
          name: 'PostHog',
          concern: 'ユーザー行動',
          configured: true,
          adminPath: '/analytics',
          externalUrl: 'https://us.posthog.com/project/378500',
          description: 'PV・セッション',
        },
      ],
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, responseBody));

    const { result } = renderHook(() => useObservability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tools).toHaveLength(1);
    expect(result.current.tools[0].configured).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useObservability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tools).toEqual([]);
    expect(result.current.error).toBe('ツール状態の取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useObservability());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.tools).toEqual([]);
  });
});
