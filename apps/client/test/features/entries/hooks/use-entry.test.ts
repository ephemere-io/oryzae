import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntry, useSaveEntry } from '@/features/entries/hooks/use-entry';
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

describe('useEntry', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('fetches entry by id', async () => {
    const entry = { id: 'e1', content: 'hello', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
    apiFetch.mockResolvedValueOnce(mockResponse(true, { entry }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntry('e1', api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entry).toEqual(entry);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/entries/e1');
  });

  it('sets loading to false after fetch', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntry('e1', api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entry).toBeNull();
  });
});

describe('useSaveEntry', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('returns entry id on successful create', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { id: 'new-id' }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 'at' }));

    let saveResult: string | null = null;
    await act(async () => {
      saveResult = await result.current.save('my content');
    });

    expect(saveResult).toBe('new-id');
    expect(result.current.error).toBe('');
  });

  it('returns null and sets error on failure', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 'at' }));

    let saveResult: string | null = null;
    await act(async () => {
      saveResult = await result.current.save('my content');
    });

    expect(saveResult).toBeNull();
    expect(result.current.error).toBe('作成に失敗しました');
  });

  it('returns entry id on successful update', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 'at' }));

    let saveResult: string | null = null;
    await act(async () => {
      saveResult = await result.current.save('updated content', 'existing-id');
    });

    expect(saveResult).toBe('existing-id');
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/entries/existing-id',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
