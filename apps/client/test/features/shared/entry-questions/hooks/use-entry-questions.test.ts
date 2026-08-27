import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveQuestions } from '@/features/shared/entry-questions/hooks/use-entry-questions';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

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

    const initialProps: { key: string | undefined } = { key: undefined };
    const { result, rerender } = renderHook(
      ({ key }: { key: string | undefined }) => useActiveQuestions(api, false, key),
      { initialProps },
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
  it('配列でないレスポンスでも落ちず空のまま（エディタを巻き込まない）', async () => {
    // 素通しだと非配列が state に入り、QuestionLinker の .map でエディタ画面ごと落ちる。
    const api = createApiStub();
    api.fetch.mockResolvedValue(mockResponse(true, { error: 'boom' }));

    const { result } = renderHook(() => useActiveQuestions(api, false));

    await waitFor(() => expect(api.fetch).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('id を持たない要素は落とし、currentText 未設定は null にする', async () => {
    const api = createApiStub();
    api.fetch.mockResolvedValue(
      mockResponse(true, [
        { id: 'q1', currentText: '問い' },
        { id: 'q2' },
        { currentText: 'id 無し' },
        null,
      ]),
    );

    const { result } = renderHook(() => useActiveQuestions(api, false));

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(result.current[1].currentText).toBeNull();
  });

  it('通信が失敗しても落ちない（未処理 rejection にしない）', async () => {
    const api = createApiStub();
    api.fetch.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useActiveQuestions(api, false));

    await waitFor(() => expect(api.fetch).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
