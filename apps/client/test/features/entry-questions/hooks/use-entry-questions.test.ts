import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveQuestions } from '@/features/entry-questions/hooks/use-entry-questions';
import type { ApiClient } from '@/lib/api';

function mockResponse(ok: boolean, body: unknown): Response {
  // @type-assertion-allowed: minimal Response stub for test
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
  } as Response;
}

function createApiStub(): ApiClient & { fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn();
  return {
    baseUrl: '',
    headers: {},
    fetch,
  };
}

describe('useActiveQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authLoading が true のあいだは fetch しない', () => {
    const api = createApiStub();
    renderHook(() => useActiveQuestions(api, true));
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('api が null のときは fetch しない', () => {
    const { result } = renderHook(() => useActiveQuestions(null, false));
    expect(result.current).toEqual([]);
  });

  it('api と authLoading が揃ったら GET /api/v1/questions を呼んで結果を返す', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValueOnce(mockResponse(true, [{ id: 'q1', currentText: 'なぜ?' }]));

    const { result } = renderHook(() => useActiveQuestions(api, false));

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0]).toEqual({ id: 'q1', currentText: 'なぜ?' });
    expect(api.fetch).toHaveBeenCalledWith('/api/v1/questions');
  });

  it('refetchKey が変わったら再 fetch する (URL にも refetchKey を付ける)', async () => {
    const api = createApiStub();
    api.fetch
      .mockResolvedValueOnce(mockResponse(true, []))
      .mockResolvedValueOnce(mockResponse(true, [{ id: 'q1', currentText: 'あとから追加された' }]));

    const { result, rerender } = renderHook(
      ({ key }: { key: string | undefined }) => useActiveQuestions(api, false, key),
      { initialProps: { key: undefined as string | undefined } },
    );

    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledTimes(1);
    });
    expect(api.fetch).toHaveBeenNthCalledWith(1, '/api/v1/questions');
    expect(result.current).toEqual([]);

    rerender({ key: 'q1' });

    await waitFor(() => {
      expect(api.fetch).toHaveBeenCalledTimes(2);
    });
    expect(api.fetch).toHaveBeenNthCalledWith(2, '/api/v1/questions?refetchKey=q1');
    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].id).toBe('q1');
  });
});
