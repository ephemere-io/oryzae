import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFireFermentation } from '@/features/users/hooks/use-fire-fermentation';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

interface MockResponseInit {
  ok: boolean;
  status?: number;
  body?: unknown;
}

function mockResponse({ ok, status, body }: MockResponseInit): Response {
  return {
    ok,
    status: status ?? (ok ? 200 : 400),
    json: () => Promise.resolve(body ?? {}),
    // @type-assertion-allowed: テスト用の最小限 Response スタブ
  } as Response;
}

describe('useFireFermentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('POSTs to /fire with the params and stores the result on success', async () => {
    const body = {
      fired: [{ fermentationResultId: 'fr-1', questionId: 'q1', questionText: 'なぜ働くのか' }],
      emailSent: true,
    };
    mockFetch.mockResolvedValueOnce(mockResponse({ ok: true, status: 201, body }));

    const { result } = renderHook(() => useFireFermentation());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.fire({ userId: 'u1', questionId: 'q1', language: 'ja' });
    });

    expect(ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/admin/fermentations/fire',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'u1', questionId: 'q1', language: 'ja' }),
      }),
    );
    await waitFor(() => {
      expect(result.current.result).toEqual(body);
    });
    expect(result.current.error).toBeNull();
  });

  it('extracts the server error message on 4xx', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 400,
        body: { error: 'Question xyz not found or not active' },
      }),
    );

    const { result } = renderHook(() => useFireFermentation());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.fire({ userId: 'u1', questionId: 'xyz' });
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Question xyz not found or not active');
    expect(result.current.result).toBeNull();
  });

  it('falls back to a generic message when the response body is not parseable', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
      // @type-assertion-allowed: テスト用の最小限 Response スタブ
    } as Response);

    const { result } = renderHook(() => useFireFermentation());

    await act(async () => {
      await result.current.fire({ userId: 'u1' });
    });

    expect(result.current.error).toBe('発酵プロセスの強制発火に失敗しました');
  });

  it('reset() clears error and result', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ ok: true, status: 201, body: { fired: [], emailSent: false } }),
    );

    const { result } = renderHook(() => useFireFermentation());

    await act(async () => {
      await result.current.fire({ userId: 'u1' });
    });
    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns false when access token is missing', async () => {
    localStorage.removeItem('oryzae_admin_access_token');
    const { result } = renderHook(() => useFireFermentation());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.fire({ userId: 'u1' });
    });

    expect(ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
