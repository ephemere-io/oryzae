import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntries } from '@/features/shared/entries/hooks/use-entries';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: fetchImpl,
  };
}

describe('useEntries', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('fetches entries on mount when api is provided', async () => {
    const entries = [
      { id: '1', userId: 'u1', content: 'hello', mediaUrls: [], createdAt: '', updatedAt: '' },
    ];
    apiFetch.mockResolvedValueOnce(mockResponse(true, entries));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe('1');
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when api is null (Issue #362: api ゲート)', async () => {
    renderHook(() => useEntries(null));

    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('取得失敗時は error=true になり、retry 成功で解消する (Issue #357)', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe(true);
    expect(result.current.entries).toHaveLength(0);

    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        { id: '1', userId: 'u1', content: 'ok', mediaUrls: [], createdAt: '', updatedAt: '' },
      ]),
    );

    await act(async () => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(false);
    });
    expect(result.current.entries).toHaveLength(1);
  });

  it('returns empty array when no entries', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, []));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it('supports cursor-based pagination (loadMore)', async () => {
    // カーソルは最後の entry の createdAt を渡す（サーバーの created_at 比較に対応）。
    // id ではなく createdAt なので、各 entry に実在しうる日時を持たせる。
    const page1 = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      userId: 'u1',
      content: `entry ${i}`,
      mediaUrls: [],
      createdAt: `2026-01-${String(i + 1).padStart(2, '0')}`,
      updatedAt: '',
    }));
    const page2 = [
      {
        id: 'e20',
        userId: 'u1',
        content: 'entry 20',
        mediaUrls: [],
        createdAt: '2026-01-21',
        updatedAt: '',
      },
    ];

    apiFetch.mockResolvedValueOnce(mockResponse(true, page1));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(20);
    expect(result.current.hasMore).toBe(true);

    apiFetch.mockResolvedValueOnce(mockResponse(true, page2));

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(21);
    expect(result.current.hasMore).toBe(false);
    // 旧バグ: cursor=e19（id）。修正後は最後の entry の createdAt を渡す。
    expect(apiFetch.mock.calls[1][0]).toContain('cursor=2026-01-20');
  });

  it('sends q param when search is provided', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        {
          id: '1',
          userId: 'u1',
          content: '天気が良い',
          mediaUrls: [],
          createdAt: '',
          updatedAt: '',
        },
      ]),
    );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api, '天気'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(apiFetch.mock.calls[0][0]).toContain('q=%E5%A4%A9%E6%B0%97');
    expect(result.current.entries).toHaveLength(1);
  });

  it('resets entries when search changes', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        { id: '1', userId: 'u1', content: 'first', mediaUrls: [], createdAt: '', updatedAt: '' },
      ]),
    );
    const api = createMockApi(apiFetch);

    const { result, rerender } = renderHook(({ search }) => useEntries(api, search), {
      initialProps: { search: 'first' },
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);

    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        { id: '2', userId: 'u1', content: 'second', mediaUrls: [], createdAt: '', updatedAt: '' },
      ]),
    );

    rerender({ search: 'second' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe('2');
  });

  it('removeEntry drops the matching entry from state', async () => {
    const entries = [
      { id: '1', userId: 'u1', content: 'a', mediaUrls: [], createdAt: '', updatedAt: '' },
      { id: '2', userId: 'u1', content: 'b', mediaUrls: [], createdAt: '', updatedAt: '' },
    ];
    apiFetch.mockResolvedValueOnce(mockResponse(true, entries));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(2);

    act(() => {
      result.current.removeEntry('1');
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe('2');
  });

  it('does not send q param when search is empty', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, []));
    const api = createMockApi(apiFetch);

    renderHook(() => useEntries(api, ''));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    expect(apiFetch.mock.calls[0][0]).not.toContain('q=');
  });

  it('Issue #323: サーバー返却の linkedQuestions を Entry にそのまま載せる', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        {
          id: '1',
          userId: 'u1',
          content: 'today',
          mediaUrls: [],
          createdAt: '',
          updatedAt: '',
          linkedQuestions: [
            { id: 'q1', currentText: '今日学んだことは？' },
            { id: 'q2', currentText: null },
          ],
        },
      ]),
    );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries[0].linkedQuestions).toEqual([
      { id: 'q1', currentText: '今日学んだことは？' },
      { id: 'q2', currentText: null },
    ]);
  });

  it('Issue #331: questionId が与えられたら URL に含める', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, []));
    const api = createMockApi(apiFetch);

    renderHook(() => useEntries(api, undefined, 'q-123'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    expect(apiFetch.mock.calls[0][0]).toContain('questionId=q-123');
  });

  it('Issue #331: questionId が未指定なら URL に含めない', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, []));
    const api = createMockApi(apiFetch);

    renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    expect(apiFetch.mock.calls[0][0]).not.toContain('questionId=');
  });

  it('Issue #331: questionId が変わったらエントリと cursor をリセットする', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        { id: '1', userId: 'u1', content: 'q1 entry', mediaUrls: [], createdAt: '', updatedAt: '' },
      ]),
    );
    const api = createMockApi(apiFetch);

    const { result, rerender } = renderHook(
      ({ qid }: { qid?: string }) => useEntries(api, undefined, qid),
      { initialProps: { qid: 'q-a' } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);

    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        { id: '2', userId: 'u1', content: 'q2 entry', mediaUrls: [], createdAt: '', updatedAt: '' },
      ]),
    );

    rerender({ qid: 'q-b' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe('2');
  });

  it('ソート: order 未指定なら order=newest を送る（既定）', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, []));
    const api = createMockApi(apiFetch);

    renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    expect(apiFetch.mock.calls[0][0]).toContain('order=newest');
  });

  it('ソート: order=oldest を指定したら URL に含める', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, []));
    const api = createMockApi(apiFetch);

    renderHook(() => useEntries(api, undefined, undefined, 'oldest'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    expect(apiFetch.mock.calls[0][0]).toContain('order=oldest');
  });

  it('ソート: order が変わったらエントリと cursor をリセットして取り直す', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        {
          id: '1',
          userId: 'u1',
          content: 'newest first',
          mediaUrls: [],
          createdAt: '2026-01-02',
          updatedAt: '',
        },
      ]),
    );
    const api = createMockApi(apiFetch);

    // initialProps を union 型で明示し、renderHook の Props 推論を 'newest'|'oldest' に広げる
    // （リテラル narrowing で rerender('oldest') が型エラーになるのを防ぐ）。
    const initialProps: { order: 'newest' | 'oldest' } = { order: 'newest' };
    const { result, rerender } = renderHook(
      ({ order }) => useEntries(api, undefined, undefined, order),
      { initialProps },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries[0].id).toBe('1');

    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        {
          id: '2',
          userId: 'u1',
          content: 'oldest first',
          mediaUrls: [],
          createdAt: '2026-01-01',
          updatedAt: '',
        },
      ]),
    );

    rerender({ order: 'oldest' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe('2');
    expect(apiFetch.mock.calls[1][0]).toContain('order=oldest');
  });

  it('Issue #323: linkedQuestions 欠落時は空配列にフォールバックする', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        { id: '1', userId: 'u1', content: 'x', mediaUrls: [], createdAt: '', updatedAt: '' },
      ]),
    );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntries(api));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entries[0].linkedQuestions).toEqual([]);
  });
});
