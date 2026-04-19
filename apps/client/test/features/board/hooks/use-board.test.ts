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
          createdAt: '2026-04-11T00:00:00Z',
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
          createdAt: '2026-04-12T00:00:00Z',
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

  it('デフォルトでは作成日時が新しいカードほど高い zIndex を持つ', async () => {
    const boardData = {
      dateKey: '2026-04-11',
      viewType: 'daily',
      cards: [
        {
          id: 'c-old',
          cardType: 'entry',
          refId: 'e-1',
          x: 100,
          y: 100,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 1,
          createdAt: '2026-04-11T08:00:00Z',
          content: { title: 'Old', preview: 'Old entry', createdAt: '2026-04-11T08:00:00Z' },
        },
        {
          id: 'c-new',
          cardType: 'snippet',
          refId: 's-1',
          x: 200,
          y: 200,
          rotation: 0,
          width: 260,
          height: 120,
          zIndex: 0,
          createdAt: '2026-04-11T14:00:00Z',
          content: { text: 'Newer snippet' },
        },
      ],
    };
    apiFetch.mockResolvedValueOnce(mockResponse(true, boardData));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useBoard(api, '2026-04-11'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const oldCard = result.current.cards.find((c) => c.id === 'c-old');
    const newCard = result.current.cards.find((c) => c.id === 'c-new');
    expect(newCard!.zIndex).toBeGreaterThan(oldCard!.zIndex);
  });

  it('dateKey を高速に切り替えても、古いリクエストの結果で新しい日付の状態を上書きしない', async () => {
    const stale = {
      dateKey: '2026-04-11',
      viewType: 'daily',
      cards: [
        {
          id: 'stale-card',
          cardType: 'entry',
          refId: 'e-stale',
          x: 0,
          y: 0,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 0,
          createdAt: '2026-04-11T00:00:00Z',
          content: { title: 'Stale', preview: 'P', createdAt: '2026-04-11T00:00:00Z' },
        },
      ],
    };
    const fresh = {
      dateKey: '2026-04-12',
      viewType: 'daily',
      cards: [
        {
          id: 'fresh-card',
          cardType: 'entry',
          refId: 'e-fresh',
          x: 0,
          y: 0,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 0,
          createdAt: '2026-04-12T00:00:00Z',
          content: { title: 'Fresh', preview: 'P', createdAt: '2026-04-12T00:00:00Z' },
        },
      ],
    };

    let resolveStale!: (r: Response) => void;
    const stalePending = new Promise<Response>((res) => {
      resolveStale = res;
    });
    apiFetch.mockReturnValueOnce(stalePending);
    apiFetch.mockResolvedValueOnce(mockResponse(true, fresh));
    const api = createMockApi(apiFetch);

    const { result, rerender } = renderHook(({ dateKey }) => useBoard(api, dateKey), {
      initialProps: { dateKey: '2026-04-11' },
    });

    // Switch date before the first request resolves.
    rerender({ dateKey: '2026-04-12' });

    await waitFor(() => {
      expect(result.current.cards).toHaveLength(1);
      expect(result.current.cards[0].id).toBe('fresh-card');
    });

    // Now let the stale request resolve — it must NOT overwrite the fresh state.
    resolveStale(mockResponse(true, stale));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].id).toBe('fresh-card');
  });

  it('ユーザー操作で変更された zIndex はデフォルトソートより優先される', async () => {
    const boardData = {
      dateKey: '2026-04-11',
      viewType: 'daily',
      cards: [
        {
          id: 'c-old-dragged',
          cardType: 'entry',
          refId: 'e-1',
          x: 100,
          y: 100,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 10,
          createdAt: '2026-04-11T08:00:00Z',
          content: { title: 'Old but dragged', preview: 'P', createdAt: '2026-04-11T08:00:00Z' },
        },
        {
          id: 'c-new',
          cardType: 'snippet',
          refId: 's-1',
          x: 200,
          y: 200,
          rotation: 0,
          width: 260,
          height: 120,
          zIndex: 1,
          createdAt: '2026-04-11T14:00:00Z',
          content: { text: 'Newer snippet' },
        },
      ],
    };
    apiFetch.mockResolvedValueOnce(mockResponse(true, boardData));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useBoard(api, '2026-04-11'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const draggedCard = result.current.cards.find((c) => c.id === 'c-old-dragged');
    const newCard = result.current.cards.find((c) => c.id === 'c-new');
    // The dragged card has zIndex 10 (>= totalCards=2), so it's user-modified and stays on top
    expect(draggedCard!.zIndex).toBeGreaterThan(newCard!.zIndex);
  });
});
