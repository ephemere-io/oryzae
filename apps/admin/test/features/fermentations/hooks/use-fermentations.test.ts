import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFermentations } from '@/features/fermentations/hooks/use-fermentations';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('useFermentations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('fetches fermentations on mount', async () => {
    const responseBody = {
      data: [
        {
          id: 'f1',
          user_id: 'u1',
          question_id: 'q1',
          entry_id: 'e1',
          target_period: '2026-04-11',
          status: 'completed',
          generation_id: null,
          created_at: '2026-04-11T10:00:00Z',
          updated_at: '2026-04-11T10:01:00Z',
        },
      ],
      pagination: { page: 1, limit: 30, total: 1 },
    };
    mockFetch.mockResolvedValueOnce(mockResponse(true, responseBody));

    const { result } = renderHook(() => useFermentations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].status).toBe('completed');
  });

  it('passes userId and status filters to API', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(true, { data: [], pagination: { page: 1, limit: 30, total: 0 } }),
    );

    renderHook(() => useFermentations({ userId: 'u123', status: 'failed' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('user_id=u123');
    expect(calledUrl).toContain('status=failed');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useFermentations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('発酵データの取得に失敗しました');
  });
});
