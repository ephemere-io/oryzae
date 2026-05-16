import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntryFermentationDetail } from '@/features/entries/hooks/use-entry-fermentation-detail';
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
    // @type-assertion-allowed: テスト用の最小 Response スタブ
  } as Response;
}

describe('useEntryFermentationDetail', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('questionId が undefined のときは fetch せず detail は null', async () => {
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useEntryFermentationDetail(api, undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.detail).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('api が null のときは fetch せず detail は null', async () => {
    const { result } = renderHook(() => useEntryFermentationDetail(null, 'q1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.detail).toBeNull();
  });

  it('完了済み発酵がなければ detail は null', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        { id: 'f1', questionId: 'q1', status: 'pending', createdAt: '2025-01-01' },
      ]),
    );
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useEntryFermentationDetail(api, 'q1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.detail).toBeNull();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('完了済み発酵があれば最新のものを fetch して正規化する', async () => {
    apiFetch
      .mockResolvedValueOnce(
        mockResponse(true, [
          { id: 'f-old', questionId: 'q1', status: 'completed', createdAt: '2025-01-01' },
          { id: 'f-new', questionId: 'q1', status: 'completed', createdAt: '2025-02-01' },
        ]),
      )
      .mockResolvedValueOnce(
        mockResponse(true, {
          id: 'f-new',
          questionId: 'q1',
          status: 'completed',
          keywords: [{ id: 'k1', keyword: 'hello', description: 'desc' }],
          snippets: [
            {
              id: 's1',
              snippetType: 'core',
              originalText: 'orig',
              sourceDate: '2025-01-15',
              selectionReason: 'because',
            },
          ],
          letter: { id: 'l1', bodyText: 'dear self' },
        }),
      );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntryFermentationDetail(api, 'q1'));

    await waitFor(() => {
      expect(result.current.detail).not.toBeNull();
    });

    const detail = result.current.detail;
    expect(detail).not.toBeNull();
    if (!detail) return;
    expect(detail.id).toBe('f-new');
    expect(detail.keywords).toHaveLength(1);
    expect(detail.keywords[0].keyword).toBe('hello');
    expect(detail.snippets).toHaveLength(1);
    expect(detail.snippets[0].snippetType).toBe('core');
    expect(detail.letter?.bodyText).toBe('dear self');
    // List + detail call
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch.mock.calls[1][0]).toBe('/api/v1/fermentations/f-new');
  });

  it('list が ok=false なら detail は null', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, null));
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useEntryFermentationDetail(api, 'q1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.detail).toBeNull();
  });

  it('detail レスポンスが completed 以外なら null として扱う', async () => {
    apiFetch
      .mockResolvedValueOnce(
        mockResponse(true, [
          { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2025-01-01' },
        ]),
      )
      .mockResolvedValueOnce(
        mockResponse(true, {
          id: 'f1',
          questionId: 'q1',
          status: 'pending',
          keywords: [],
          snippets: [],
          letter: null,
        }),
      );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntryFermentationDetail(api, 'q1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.detail).toBeNull();
  });

  it('不正な snippetType は core に正規化される', async () => {
    apiFetch
      .mockResolvedValueOnce(
        mockResponse(true, [
          { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2025-01-01' },
        ]),
      )
      .mockResolvedValueOnce(
        mockResponse(true, {
          id: 'f1',
          questionId: 'q1',
          status: 'completed',
          keywords: [],
          snippets: [
            {
              id: 's1',
              snippetType: 'unknown_type',
              originalText: 't',
              sourceDate: 'd',
              selectionReason: 'r',
            },
          ],
          letter: null,
        }),
      );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntryFermentationDetail(api, 'q1'));

    await waitFor(() => {
      expect(result.current.detail).not.toBeNull();
    });

    expect(result.current.detail?.snippets[0].snippetType).toBe('core');
  });
});
