import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFailureAlerts } from '@/features/dashboard/hooks/use-failure-alerts';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const sampleGroups = [
  {
    userId: 'u1',
    email: 'test@example.com',
    avatarUrl: null,
    failures: [
      {
        fermentationId: 'f1',
        errorMessage: 'Something went wrong',
        createdAt: '2026-04-12T10:00:00Z',
      },
    ],
  },
];

describe('useFailureAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches failure groups on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleGroups));

    const { result } = renderHook(() => useFailureAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.groups).toEqual(sampleGroups);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Server Error' }));

    const { result } = renderHook(() => useFailureAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.error).toBe('障害情報の取得に失敗しました');
  });

  it('does nothing when no token is stored', async () => {
    localStorage.clear();

    const { result } = renderHook(() => useFailureAlerts());

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.groups).toEqual([]);
  });

  it('retryFermentation calls POST and refreshes', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleGroups));

    const { result } = renderHook(() => useFailureAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Mock the retry POST and the subsequent refresh GET
    mockFetch.mockResolvedValueOnce(mockResponse(true, { ok: true }));
    mockFetch.mockResolvedValueOnce(mockResponse(true, []));

    let retryResult: boolean;
    await act(async () => {
      retryResult = await result.current.retryFermentation('f1');
    });

    expect(retryResult!).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/fermentations/f1/retry',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('retryFermentation returns false on failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, sampleGroups));

    const { result } = renderHook(() => useFailureAlerts());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetch.mockResolvedValueOnce(mockResponse(false, { error: 'Failed' }));

    let retryResult: boolean;
    await act(async () => {
      retryResult = await result.current.retryFermentation('f1');
    });

    expect(retryResult!).toBe(false);
  });
});
