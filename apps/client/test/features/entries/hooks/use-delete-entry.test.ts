import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeleteEntry } from '@/features/entries/hooks/use-delete-entry';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: fetchImpl,
  };
}

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 400,
  } as Response;
}

describe('useDeleteEntry', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('sends DELETE request and returns true on success', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { ok: true }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useDeleteEntry(api));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteEntry('e1');
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBe('');
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/entries/e1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('returns false and sets error on failure', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useDeleteEntry(api));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteEntry('e1');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('削除に失敗しました');
  });

  it('returns false when api is null', async () => {
    const { result } = renderHook(() => useDeleteEntry(null));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.deleteEntry('e1');
    });

    expect(ok).toBe(false);
  });
});
