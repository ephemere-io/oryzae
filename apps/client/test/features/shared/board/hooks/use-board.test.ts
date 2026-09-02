import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoard } from '@/features/shared/board/hooks/use-board';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
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
          cardType: 'snippet',
          refId: 'e-1',
          x: 100,
          y: 200,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 0,
          createdAt: '2026-04-11T00:00:00Z',
          content: { text: 'Test' },
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
    // ローカル暦日で「その日」を判定させるため tzOffset を必ず添える
    // （無いとサーバーが UTC 窓とみなし、JST 00:00-09:00 の投稿を取りこぼす）
    expect(apiFetch).toHaveBeenCalledWith(
      `/api/v1/board?dateKey=2026-04-11&viewType=daily&tzOffset=${new Date().getTimezoneOffset()}`,
    );
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
          cardType: 'snippet',
          refId: 'e-2',
          x: 50,
          y: 50,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 0,
          createdAt: '2026-04-12T00:00:00Z',
          content: { text: 'Test' },
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
          cardType: 'snippet',
          refId: 'e-1',
          x: 100,
          y: 100,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 1,
          createdAt: '2026-04-11T08:00:00Z',
          content: { text: 'Test' },
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
          cardType: 'snippet',
          refId: 'e-stale',
          x: 0,
          y: 0,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 0,
          createdAt: '2026-04-11T00:00:00Z',
          content: { text: 'Test' },
        },
      ],
    };
    const fresh = {
      dateKey: '2026-04-12',
      viewType: 'daily',
      cards: [
        {
          id: 'fresh-card',
          cardType: 'snippet',
          refId: 'e-fresh',
          x: 0,
          y: 0,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 0,
          createdAt: '2026-04-12T00:00:00Z',
          content: { text: 'Test' },
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
          cardType: 'snippet',
          refId: 'e-1',
          x: 100,
          y: 100,
          rotation: 0,
          width: 340,
          height: 280,
          zIndex: 10,
          userPositioned: true,
          createdAt: '2026-04-11T08:00:00Z',
          content: { text: 'Test' },
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
  it('cards を欠くレスポンスでも固まらない（loading が戻り、カードは空）', async () => {
    // エラーエンベロープやスキーマ変更で cards が来ないケース。素通しだと
    // applyDefaultZOrder が undefined.length で落ち、useEffect 内の未処理 rejection として
    // 握り潰されて loading が true のまま固まっていた。
    apiFetch.mockResolvedValueOnce(mockResponse(true, { error: 'boom' }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useBoard(api, '2026-04-11'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toEqual([]);
  });

  it('通信自体が失敗しても loading が戻る', async () => {
    apiFetch.mockRejectedValueOnce(new Error('network down'));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useBoard(api, '2026-04-11'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards).toEqual([]);
  });

  it('壊れたカードは落とし、欠けた座標は既定値に潰す', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, {
        dateKey: '2026-04-11',
        viewType: 'daily',
        cards: [
          { id: 'ok', cardType: 'snippet', refId: 's-1', content: { text: 'hi' } },
          { cardType: 'snippet', refId: 's-2', content: { text: 'id 無し' } },
          { id: 'bad-type', cardType: 'unknown', refId: 's-3', content: { text: 'x' } },
          { id: 'no-content', cardType: 'snippet', refId: 's-4' },
        ],
      }),
    );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useBoard(api, '2026-04-11'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cards.map((c) => c.id)).toEqual(['ok']);
    const card = result.current.cards[0];
    expect(card.x).toBe(0);
    expect(card.y).toBe(0);
    expect(card.width).toBeGreaterThan(0);
    expect(card.height).toBeGreaterThan(0);
  });
  describe('deleteCard', () => {
    const oneCard = {
      dateKey: '2026-04-11',
      viewType: 'daily',
      cards: [{ id: 'c-1', cardType: 'snippet', refId: 's-1', content: { text: 'あ' }, zIndex: 0 }],
    };

    it('削除が成功したらカードを取り除く', async () => {
      apiFetch
        .mockResolvedValueOnce(mockResponse(true, oneCard))
        .mockResolvedValueOnce(mockResponse(true, {}));
      const api = createMockApi(apiFetch);

      const { result } = renderHook(() => useBoard(api, '2026-04-11'));
      await waitFor(() => expect(result.current.cards).toHaveLength(1));

      await act(async () => {
        await result.current.deleteCard('c-1', 'snippet', 's-1');
      });

      expect(apiFetch.mock.calls[1][0]).toContain('/api/v1/board/snippets/s-1');
      expect(apiFetch.mock.calls[1][1]?.method).toBe('DELETE');
      expect(result.current.cards).toHaveLength(0);
    });

    it('削除が失敗したらカードを消さずに戻す（リロードで復活する嘘を防ぐ）', async () => {
      apiFetch
        .mockResolvedValueOnce(mockResponse(true, oneCard))
        .mockResolvedValueOnce(mockResponse(false, {}));
      const api = createMockApi(apiFetch);

      const { result } = renderHook(() => useBoard(api, '2026-04-11'));
      await waitFor(() => expect(result.current.cards).toHaveLength(1));

      await act(async () => {
        await result.current.deleteCard('c-1', 'snippet', 's-1');
      });

      expect(result.current.cards).toHaveLength(1);
      // アニメーション用のフラグも戻す（消えかけの見た目で固まらせない）
      expect(result.current.cards[0].removing).toBe(false);
    });

    it('通信自体が失敗してもカードを残す（未処理 rejection にしない）', async () => {
      apiFetch
        .mockResolvedValueOnce(mockResponse(true, oneCard))
        .mockRejectedValueOnce(new Error('network down'));
      const api = createMockApi(apiFetch);

      const { result } = renderHook(() => useBoard(api, '2026-04-11'));
      await waitFor(() => expect(result.current.cards).toHaveLength(1));

      await act(async () => {
        await result.current.deleteCard('c-1', 'snippet', 's-1');
      });

      expect(result.current.cards).toHaveLength(1);
      expect(result.current.cards[0].removing).toBe(false);
    });
  });
  describe('error', () => {
    it('取得に失敗したら error が立つ（「空の盤面」と区別できるようにする）', async () => {
      apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
      const api = createMockApi(apiFetch);

      const { result } = renderHook(() => useBoard(api, '2026-04-11'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe(true);
      expect(result.current.cards).toEqual([]);
    });

    it('通信が失敗しても error が立つ', async () => {
      apiFetch.mockRejectedValueOnce(new Error('network down'));
      const api = createMockApi(apiFetch);

      const { result } = renderHook(() => useBoard(api, '2026-04-11'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error).toBe(true);
    });

    it('再取得が成功したら error は下りる', async () => {
      apiFetch.mockResolvedValueOnce(mockResponse(false, {})).mockResolvedValueOnce(
        mockResponse(true, {
          dateKey: '2026-04-11',
          viewType: 'daily',
          cards: [
            { id: 'c-1', cardType: 'snippet', refId: 's-1', content: { text: 'あ' }, zIndex: 0 },
          ],
        }),
      );
      const api = createMockApi(apiFetch);

      const { result } = renderHook(() => useBoard(api, '2026-04-11'));
      await waitFor(() => expect(result.current.error).toBe(true));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toBe(false);
      expect(result.current.cards).toHaveLength(1);
    });
  });
  it('カードが減っても、触っていないカードを「動かした」と誤判定しない', async () => {
    // 旧実装は「zIndex >= 総枚数」でユーザー操作を推測していた。カードを削除すると
    // 総枚数が縮むため、採番当時のまま残った zIndex が判定を満たしてしまい、
    // 触っていないカードが作成日時順から外れて手前に固定されていた。
    // ここは「4枚から1枚消して3枚になり、zIndex に 3 が残っている」状況。
    const boardData = {
      dateKey: '2026-04-11',
      viewType: 'daily',
      cards: [
        {
          id: 'c-oldest',
          cardType: 'snippet',
          refId: 's-1',
          zIndex: 3, // 旧実装だと 3 >= 3 で「ユーザーが動かした」扱いになっていた
          userPositioned: false,
          createdAt: '2026-04-11T08:00:00Z',
          content: { text: '一番古い' },
        },
        {
          id: 'c-middle',
          cardType: 'snippet',
          refId: 's-2',
          zIndex: 0,
          userPositioned: false,
          createdAt: '2026-04-11T10:00:00Z',
          content: { text: '真ん中' },
        },
        {
          id: 'c-newest',
          cardType: 'snippet',
          refId: 's-3',
          zIndex: 1,
          userPositioned: false,
          createdAt: '2026-04-11T14:00:00Z',
          content: { text: '一番新しい' },
        },
      ],
    };
    apiFetch.mockResolvedValueOnce(mockResponse(true, boardData));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useBoard(api, '2026-04-11'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const byId = (id: string) => result.current.cards.find((c) => c.id === id);
    // 3枚とも自動配置なので、作成日時順に並び直る（新しいものほど手前）
    expect(byId('c-oldest')!.zIndex).toBeLessThan(byId('c-middle')!.zIndex);
    expect(byId('c-middle')!.zIndex).toBeLessThan(byId('c-newest')!.zIndex);
  });
  it('写真の作成が失敗したら投げ返す（黙って閉じさせない）', async () => {
    // 以前は res.ok を見て false なら何もせず返していた。呼び出し側の PhotoDialog は
    // 例外が来たときだけエラーを出すので、失敗が画面に何も残らず
    // 「押しても貼れない」としか見えなかった。
    apiFetch.mockResolvedValueOnce(mockResponse(true, { dateKey: '2026-04-11', cards: [] }));
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useBoard(api, '2026-04-11'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    apiFetch.mockResolvedValueOnce(mockResponse(false, { error: 'boom' }));
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await expect(result.current.createPhoto(file, '', 10, 10)).rejects.toThrow(
      /create board photo/,
    );
  });

  it('写真の作成に成功したらボードを取り直す', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { dateKey: '2026-04-11', cards: [] }));
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useBoard(api, '2026-04-11'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    apiFetch.mockResolvedValueOnce(mockResponse(true, { photoId: 'p-1' }));
    apiFetch.mockResolvedValueOnce(mockResponse(true, { dateKey: '2026-04-11', cards: [] }));
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await act(async () => {
      await result.current.createPhoto(file, 'キャプション', 10, 10);
    });

    const paths = apiFetch.mock.calls.map((c) => c[0]);
    expect(paths).toContain('/api/v1/board/photos');
    // 作成 → 再取得 の順で2本目以降が飛んでいる
    expect(paths.filter((p) => p.startsWith('/api/v1/board?')).length).toBeGreaterThanOrEqual(2);
  });
});
