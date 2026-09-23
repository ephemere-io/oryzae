import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardSummary } from '@/features/shared/board/hooks/use-board-summary';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

// api は **レンダーをまたいで同じ参照**にする。renderHook のコールバックの中で作ると
// 毎レンダー別物になり、effect が回り直して 2 回目の取得が走ってしまう。
function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function summaryBody() {
  return {
    total: 12,
    snippets: 9,
    photos: 3,
    cards: [
      {
        id: 'c-1',
        cardType: 'snippet',
        refId: 's-1',
        x: 10,
        y: 20,
        rotation: 0,
        width: 262,
        height: 120,
        zIndex: 2,
        createdAt: '2026-09-10T00:00:00Z',
        content: { text: '壁に出る付箋' },
      },
      {
        id: 'c-2',
        cardType: 'photo',
        refId: 'p-1',
        x: 300,
        y: 40,
        rotation: 3,
        width: 200,
        height: 250,
        zIndex: 1,
        createdAt: '2026-09-09T00:00:00Z',
        content: { imageUrl: 'https://example.com/a.jpg', caption: '' },
      },
    ],
  };
}

describe('useBoardSummary', () => {
  let apiFetch: ReturnType<typeof vi.fn>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
    api = createMockApi(apiFetch);
  });

  it('壁に貼るカードを取り出す（数だけでなくカードも）', async () => {
    // レスポンスの封筒をそのまま正規化に渡す。以前は cards 配列だけを渡しており、
    // 正規化が常に空を返して**書斎の壁からカードが消えていた**（数と内訳だけが出る）。
    apiFetch.mockResolvedValueOnce(mockResponse(true, summaryBody()));

    const { result } = renderHook(() => useBoardSummary(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiFetch).toHaveBeenCalledWith('/api/v1/board/summary');
    expect(result.current.summary.cards.map((c) => c.id)).toEqual(['c-1', 'c-2']);
    expect(result.current.summary).toMatchObject({ total: 12, snippets: 9, photos: 3 });
    expect(result.current.error).toBe(false);
  });

  it('認証の解決待ちでは取りに行かない', () => {
    renderHook(() => useBoardSummary(api, true));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('失敗したら error を立て、壁は空のまま（部分的な失敗で書斎を落とさない）', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));

    const { result } = renderHook(() => useBoardSummary(api, false));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.summary).toEqual({ total: 0, snippets: 0, photos: 0, cards: [] });
  });

  it('通信自体が失敗しても固まらない', async () => {
    apiFetch.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useBoardSummary(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });
});
