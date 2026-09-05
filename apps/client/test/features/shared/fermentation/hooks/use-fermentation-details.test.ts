import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 400,
    // @type-assertion-allowed: テスト用の最小 Response スタブ
  } as Response;
}

function detailBody(id: string, status = 'completed') {
  return {
    id,
    questionId: 'q1',
    status,
    targetPeriod: 'WEEK 35',
    keywords: [{ id: `${id}-k`, keyword: '速度差', description: 'desc' }],
    snippets: [],
    letter: { id: `${id}-l`, bodyText: 'dear self' },
    scannedEntries: [{ id: 'e1', title: 't', createdAt: '2026-08-27' }],
  };
}

/** URL から id を返す fetch スタブ。呼ばれた順に依存せず判定できる。 */
function detailRouter(overrides: Record<string, Response> = {}) {
  return vi.fn((url: string) => {
    const id = url.split('/').pop() ?? '';
    return Promise.resolve(overrides[id] ?? mockResponse(true, detailBody(id)));
  });
}

describe('useFermentationDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('api が null なら fetch しない', () => {
    const apiFetch = detailRouter();
    renderHook(() => useFermentationDetails(null, ['f1']));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('id を渡さなければ fetch しない', () => {
    const apiFetch = detailRouter();
    const api = createMockApi(apiFetch);
    renderHook(() => useFermentationDetails(api, []));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('渡された id ぶんを並行で取り、id をキーに返す', async () => {
    const apiFetch = detailRouter();
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationDetails(api, ['f1', 'f2']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.details.get('f1')?.keywords[0].keyword).toBe('速度差');
    expect(result.current.details.get('f2')?.letter?.bodyText).toBe('dear self');
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('取得済みの id は再取得しない（めくって戻っても取り直さない）', async () => {
    const apiFetch = detailRouter();
    const api = createMockApi(apiFetch);
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useFermentationDetails(api, ids),
      { initialProps: { ids: ['f1', 'f2'] } },
    );

    await waitFor(() => {
      expect(result.current.details.size).toBe(2);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);

    // 1 段めくる: f3 が増え f1 が外れる。新規は f3 だけ。
    rerender({ ids: ['f2', 'f3'] });
    await waitFor(() => {
      expect(result.current.details.size).toBe(3);
    });
    expect(apiFetch).toHaveBeenCalledTimes(3);

    // 戻る: 全部キャッシュ済みなので追加の fetch は起きない。
    rerender({ ids: ['f1', 'f2'] });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(apiFetch).toHaveBeenCalledTimes(3);
    // 外れた id もキャッシュに残る（戻ったときに即座に出せる）。
    expect(result.current.details.get('f1')).toBeDefined();
  });

  it('completed 以外の詳細はキャッシュに載せない', async () => {
    const apiFetch = detailRouter({ f1: mockResponse(true, detailBody('f1', 'pending')) });
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationDetails(api, ['f1', 'f2']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.details.has('f1')).toBe(false);
    expect(result.current.details.has('f2')).toBe(true);
  });

  it('1 件が ok=false でも他の円盤は出せる', async () => {
    const apiFetch = detailRouter({ f1: mockResponse(false, null) });
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationDetails(api, ['f1', 'f2']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.details.has('f1')).toBe(false);
    expect(result.current.details.get('f2')?.id).toBe('f2');
  });

  it('取得中に ids が変わっても、取れた詳細は捨てない（めくる速さが取得より速いとき）', async () => {
    // 実バグの再現: cleanup で結果を捨てつつ requested には id を残していたため、
    // 「その発酵を見るためにめくる操作」がその発酵の取得を打ち切り、2 段目から先が
    // 永久に空白になっていた（Vercel プレビューで発覚）。
    const resolvers: Record<string, (r: Response) => void> = {};
    const apiFetch = vi.fn((url: string) => {
      const id = url.split('/').pop() ?? '';
      return new Promise<Response>((resolve) => {
        resolvers[id] = resolve;
      });
    });
    const api = createMockApi(apiFetch);
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useFermentationDetails(api, ids),
      { initialProps: { ids: ['f3', 'f4'] } },
    );

    // f3/f4 の取得が飛んでいる最中に 1 段めくる（= ids が入れ替わる）。
    rerender({ ids: ['f2', 'f3', 'f4'] });
    // さらにもう 1 段めくる。ここで従来は f2 の結果が捨てられていた。
    rerender({ ids: ['f1', 'f2', 'f3'] });

    // 遅れて全部が返ってくる。
    await act(async () => {
      for (const id of ['f1', 'f2', 'f3', 'f4']) {
        resolvers[id]?.(mockResponse(true, detailBody(id)));
      }
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // どの段の詳細も落ちていない。
    for (const id of ['f1', 'f2', 'f3', 'f4']) {
      expect(result.current.details.get(id)?.id).toBe(id);
    }
  });

  it('アンマウント後に解決しても state を触らない', async () => {
    const resolvers: Record<string, (r: Response) => void> = {};
    const apiFetch = vi.fn((url: string) => {
      const id = url.split('/').pop() ?? '';
      return new Promise<Response>((resolve) => {
        resolvers[id] = resolve;
      });
    });
    // api は毎レンダー同じ参照でなければならない（呼び出し側は context から受け取る）。
    const api = createMockApi(apiFetch);
    const { unmount } = renderHook(() => useFermentationDetails(api, ['f1']));
    unmount();
    // 解決してもエラーにならない（React の警告も出ない）。
    await act(async () => {
      resolvers.f1?.(mockResponse(true, detailBody('f1')));
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('fetch が reject しても loading は解け、失敗した id は取りに行き直さない', async () => {
    const apiFetch = vi.fn((url: string) => {
      const id = url.split('/').pop() ?? '';
      return id === 'f1'
        ? Promise.reject(new Error('network down'))
        : Promise.resolve(mockResponse(true, detailBody(id)));
    });
    const api = createMockApi(apiFetch);
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useFermentationDetails(api, ids),
      { initialProps: { ids: ['f1', 'f2'] } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.details.has('f1')).toBe(false);
    expect(apiFetch).toHaveBeenCalledTimes(2);

    // 同じ id をもう一度要求しても再挑戦しない（無限リトライを作らない）。
    rerender({ ids: ['f1'] });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
