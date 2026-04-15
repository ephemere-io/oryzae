import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardCardData } from '@/features/board/hooks/use-board';
import { useBoardSave } from '@/features/board/hooks/use-board-save';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

describe('useBoardSave', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    apiFetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('500ms のデバウンス後に保存する', async () => {
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useBoardSave(api));

    const cards: BoardCardData[] = [
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
        content: { title: '', preview: '', createdAt: '' },
      },
    ];

    act(() => {
      result.current.savePositions(cards);
    });

    expect(apiFetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/board/cards',
      expect.objectContaining({
        method: 'PUT',
      }),
    );
  });

  it('連続呼び出しでは最後のみ実行する', async () => {
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useBoardSave(api));

    const cards1: BoardCardData[] = [
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
        content: { title: '', preview: '', createdAt: '' },
      },
    ];
    const cards2: BoardCardData[] = [
      {
        id: 'c-1',
        cardType: 'entry',
        refId: 'e-1',
        x: 200,
        y: 300,
        rotation: 5,
        width: 340,
        height: 280,
        zIndex: 1,
        createdAt: '2026-04-11T00:00:00Z',
        content: { title: '', preview: '', createdAt: '' },
      },
    ];

    act(() => {
      result.current.savePositions(cards1);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.savePositions(cards2);
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
