import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoard } from '@/features/board/hooks/use-board';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function mockResponse(ok: boolean, body: unknown): Response {
  return { ok, json: () => Promise.resolve(body), status: ok ? 200 : 400 } as Response;
}

describe('useBoard', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('dateKey でボードデータを取得する', async () => {
    const boardData = {
      dateKey: '2026-04-11',
      viewType: 'daily',
      cards: [
        {
          id: 'c-1',
          cardType: 'entry',
          refId: 'e-1',
          x: 100,
          y: 200,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 0,
          content: { title: 'Test', preview: 'Preview', createdAt: '2026-04-11T00:00:00Z' },
        },
      ],
    };
    apiFetch.mockResolvedValueOnce(mockResponse(true, boardData));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useBoard(api, '2026-04-11'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].id).toBe('c-1');
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/board?dateKey=2026-04-11&viewType=daily');
  });

  it('api が null の場合はフェッチしない', () => {
    renderHook(() => useBoard(null, '2026-04-11'));
    // no error thrown
  });

  it('API エラー時は cards が空のまま', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useBoard(api, '2026-04-11'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.cards).toEqual([]);
  });

  it('dateKey 変更で再フェッチする', async () => {
    const data1 = { dateKey: '2026-04-11', viewType: 'daily', cards: [] };
    const data2 = {
      dateKey: '2026-04-12',
      viewType: 'daily',
      cards: [
        {
          id: 'c-2',
          cardType: 'entry',
          refId: 'e-2',
          x: 50,
          y: 50,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 0,
          content: { title: 'T', preview: 'P', createdAt: '2026-04-12T00:00:00Z' },
        },
      ],
    };
    apiFetch.mockResolvedValueOnce(mockResponse(true, data1));
    const api = createMockApi(apiFetch);

    const { result, rerender } = renderHook(({ dateKey }) => useBoard(api, dateKey), {
      initialProps: { dateKey: '2026-04-11' },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toEqual([]);

    apiFetch.mockResolvedValueOnce(mockResponse(true, data2));
    rerender({ dateKey: '2026-04-12' });

    await waitFor(() => expect(result.current.cards).toHaveLength(1));
    expect(result.current.cards[0].id).toBe('c-2');
  });
});
