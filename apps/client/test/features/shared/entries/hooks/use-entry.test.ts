import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntry, useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import type { ApiClient } from '@/lib/api';
import { I18nWrapper } from '../../../../helpers/i18n-wrapper';
import { mockResponse } from '../../../../helpers/response';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: fetchImpl,
  };
}

describe('useEntry', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('fetches entry by id', async () => {
    // mediaUrls はストレージパス、mediaSignedUrls は表示用でレスポンス top-level。
    const entry = {
      id: 'e1',
      content: 'hello',
      mediaUrls: ['user-1/a.jpg'],
      effects: null,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, { entry, mediaSignedUrls: ['https://cdn.example/a.jpg?token=abc'] }),
    );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntry('e1', api, false), { wrapper: I18nWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entry).toEqual({
      ...entry,
      mediaSignedUrls: ['https://cdn.example/a.jpg?token=abc'],
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/entries/e1');
  });

  it('mediaUrls が無いレスポンスでも空配列で埋める', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, {
        entry: {
          id: 'e1',
          content: 'hello',
          effects: null,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      }),
    );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntry('e1', api, false), { wrapper: I18nWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entry?.mediaUrls).toEqual([]);
    expect(result.current.entry?.mediaSignedUrls).toEqual([]);
  });

  it('sets loading to false after fetch', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntry('e1', api, false), { wrapper: I18nWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entry).toBeNull();
  });
  it('形の違う応答は entry に入れない', async () => {
    // `await res.json()` は any を返すので、素通しすると未検証の値が state に入る。
    apiFetch.mockResolvedValueOnce(mockResponse(true, { entry: { content: 'no id' } }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useEntry('e1', api, false), { wrapper: I18nWrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.entry).toBeNull();
  });

  it('id を切り替えた直後は、先発の応答が後発の結果を上書きしない', async () => {
    // e1 は解決を遅らせ、e2 に切り替えた後で解決させる。cancelled ガードが無いと
    // 先発 (e1) の応答が後から state を書き換え、画面には e2 のはずが e1 の内容が残る。
    let resolveFirst: ((res: unknown) => void) | undefined;
    apiFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, {
        entry: {
          id: 'e2',
          content: 'second',
          effects: null,
          createdAt: '2024-01-02',
          updatedAt: '2024-01-02',
        },
      }),
    );
    const api = createMockApi(apiFetch);

    const { result, rerender } = renderHook(({ id }) => useEntry(id, api, false), {
      wrapper: I18nWrapper,
      initialProps: { id: 'e1' },
    });

    rerender({ id: 'e2' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.entry?.id).toBe('e2');

    // 先発 (e1) がここで遅れて解決する。破棄されていれば state は変わらない。
    await act(async () => {
      resolveFirst?.(
        mockResponse(true, {
          entry: {
            id: 'e1',
            content: 'first',
            effects: null,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        }),
      );
    });

    expect(result.current.entry?.id).toBe('e2');
  });
});

describe('useSaveEntry', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('returns entry id on successful create', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { id: 'new-id' }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 'at' }), {
      wrapper: I18nWrapper,
    });

    let saveResult: string | null = null;
    await act(async () => {
      saveResult = await result.current.save('my content');
    });

    expect(saveResult).toBe('new-id');
    expect(result.current.error).toBe('');
  });

  it('returns null and sets error on failure', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 'at' }), {
      wrapper: I18nWrapper,
    });

    let saveResult: string | null = null;
    await act(async () => {
      saveResult = await result.current.save('my content');
    });

    expect(saveResult).toBeNull();
    expect(result.current.error).toBe('作成に失敗しました');
  });

  it('returns entry id on successful update', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, {}));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 'at' }), {
      wrapper: I18nWrapper,
    });

    let saveResult: string | null = null;
    await act(async () => {
      saveResult = await result.current.save('updated content', 'existing-id');
    });

    expect(saveResult).toBe('existing-id');
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/entries/existing-id',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('fermentationEnabled 未指定時はペイロードに含めない', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { id: 'new-id' }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 'at' }), {
      wrapper: I18nWrapper,
    });

    await act(async () => {
      await result.current.save('content');
    });

    const call = apiFetch.mock.calls[0];
    const bodyStr: string = call[1].body;
    const body: Record<string, unknown> = JSON.parse(bodyStr);
    expect(body.fermentationEnabled).toBeUndefined();
  });

  it('fermentationEnabled=true を指定するとペイロードに含まれる', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { id: 'new-id' }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 'at' }), {
      wrapper: I18nWrapper,
    });

    await act(async () => {
      await result.current.save('content', undefined, { fermentationEnabled: true });
    });

    const call = apiFetch.mock.calls[0];
    const bodyStr: string = call[1].body;
    const body: Record<string, unknown> = JSON.parse(bodyStr);
    expect(body.fermentationEnabled).toBe(true);
  });

  it('200 でも id が読めなければ error を立てる（autosave の重複作成を防ぐ）', async () => {
    // 作成自体は成功しているので、無言で null を返すと呼び出し側は失敗と区別できず、
    // autosave が entryId を記録できないまま再 POST してエントリを重複作成する。
    apiFetch.mockResolvedValueOnce(mockResponse(true, { notAnId: 'oops' }));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useSaveEntry(api, { accessToken: 't' }), {
      wrapper: I18nWrapper,
    });

    let saved: string | null = 'sentinel';
    await act(async () => {
      saved = await result.current.save('hello');
    });

    expect(saved).toBeNull();
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
