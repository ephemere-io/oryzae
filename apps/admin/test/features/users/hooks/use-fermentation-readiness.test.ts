import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FermentationReadinessResponse } from '@/features/users/hooks/use-fermentation-readiness';
import { useFermentationReadiness } from '@/features/users/hooks/use-fermentation-readiness';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const mockData: FermentationReadinessResponse = {
  userId: 'user-1',
  language: 'ja',
  threshold: 1000,
  charsCurrent: 500,
  charScore: 0.5,
  timeScore: 1,
  readinessScore: 0.5,
  eligible: false,
  isFirstTime: true,
  lastRunAt: null,
  nextEligibleAt: null,
  hoursElapsed: null,
  hoursRequired: null,
};

describe('useFermentationReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches readiness on mount', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    const { result } = renderHook(() => useFermentationReadiness('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('calls correct API path with userId', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(true, mockData));

    renderHook(() => useFermentationReadiness('user-1'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const calledPath = mockFetch.mock.calls[0][0];
    expect(calledPath).toBe('/api/v1/admin/fermentations/readiness/user-1');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useFermentationReadiness('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('skips fetch when no access token', async () => {
    localStorage.removeItem('oryzae_admin_access_token');

    renderHook(() => useFermentationReadiness('user-1'));

    // 即座に fetch を呼ばないことを確認 (loading=true のまま)
    await new Promise((r) => setTimeout(r, 10));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
