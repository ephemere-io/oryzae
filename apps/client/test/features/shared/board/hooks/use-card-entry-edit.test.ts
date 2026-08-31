import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCardEntryEdit } from '@/features/shared/board/hooks/use-card-entry-edit';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

const FULL = 'これは日記の全文。'.repeat(40);

describe('useCardEntryEdit', () => {
  let apiFetch: ReturnType<typeof vi.fn>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
    // レンダーのたびに新しい api を渡すと effect が毎回張り直され、同じ Response を
    // 二度読んで失敗する。参照は固定する。
    api = createMockApi(apiFetch);
  });

  it('entryId が null のあいだは取りに行かない', () => {
    renderHook(() => useCardEntryEdit(api, null));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('編集に入ったら抜粋ではなく全文を取り直す', async () => {
    // カードが持っているのは先頭 200 文字だけ。それを保存すると日記が切り詰められる。
    apiFetch.mockResolvedValue(mockResponse(true, { entry: { id: 'e-1', content: FULL } }));

    const { result } = renderHook(() => useCardEntryEdit(api, 'e-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/entries/e-1');
    expect(result.current.content).toBe(FULL);
    expect(result.current.content.length).toBeGreaterThan(200);
  });

  it('取得に失敗したら編集させない（本文を空のままにして error を立てる）', async () => {
    apiFetch.mockResolvedValue(mockResponse(false, { error: 'boom' }));

    const { result } = renderHook(() => useCardEntryEdit(api, 'e-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.content).toBe('');
  });

  it('content が文字列でない応答も失敗として扱う', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { entry: { id: 'e-1' } }));

    const { result } = renderHook(() => useCardEntryEdit(api, 'e-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });

  it('変えていなければ保存しない', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { entry: { id: 'e-1', content: FULL } }));
    const { result } = renderHook(() => useCardEntryEdit(api, 'e-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    apiFetch.mockClear();

    let saved = true;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('変えたら PUT する。effects と fermentationEnabled は送らない（既存を維持させる）', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { entry: { id: 'e-1', content: FULL } }));
    const { result } = renderHook(() => useCardEntryEdit(api, 'e-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setContent(`${FULL}追記`));
    apiFetch.mockResolvedValue(mockResponse(true, { id: 'e-1' }));
    let saved = false;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(true);
    const [path, init] = apiFetch.mock.calls.at(-1) ?? [];
    expect(path).toBe('/api/v1/entries/e-1');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body);
    expect(body.content).toBe(`${FULL}追記`);
    // サーバは undefined を「既存を維持」と読む。送らないことが仕様。
    expect('effects' in body).toBe(false);
    expect('fermentationEnabled' in body).toBe(false);
  });

  it('空にして保存しようとしても送らない（日記を消してしまわない）', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { entry: { id: 'e-1', content: FULL } }));
    const { result } = renderHook(() => useCardEntryEdit(api, 'e-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    apiFetch.mockClear();

    act(() => result.current.setContent('   '));
    let saved = true;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('保存に失敗したら error を立て、保存済みとして扱わない', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { entry: { id: 'e-1', content: FULL } }));
    const { result } = renderHook(() => useCardEntryEdit(api, 'e-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setContent(`${FULL}追記`));
    apiFetch.mockResolvedValue(mockResponse(false, { error: 'boom' }));
    let saved = true;
    await act(async () => {
      saved = await result.current.save();
    });

    expect(saved).toBe(false);
    expect(result.current.error).toBe(true);
  });
});
