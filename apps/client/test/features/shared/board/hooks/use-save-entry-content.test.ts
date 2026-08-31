import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSaveEntryContent } from '@/features/shared/board/hooks/use-save-entry-content';
import type { ApiClient } from '@/lib/api';
import { mockResponse } from '../../../../helpers/response';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

describe('useSaveEntryContent', () => {
  let apiFetch: ReturnType<typeof vi.fn>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
    api = createMockApi(apiFetch);
  });

  it('PUT で日記を保存する', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { id: 'e-1' }));
    const { result } = renderHook(() => useSaveEntryContent(api));

    let saved = false;
    await act(async () => {
      saved = await result.current.save('e-1', '見出し\n本文');
    });

    expect(saved).toBe(true);
    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe('/api/v1/entries/e-1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).content).toBe('見出し\n本文');
  });

  it('effects と fermentationEnabled は送らない（既存を維持させる）', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { id: 'e-1' }));
    const { result } = renderHook(() => useSaveEntryContent(api));

    await act(async () => {
      await result.current.save('e-1', '本文');
    });

    const body = JSON.parse(apiFetch.mock.calls[0][1].body);
    // サーバは undefined を「既存を維持」と読む。送らないことが仕様。
    expect('effects' in body).toBe(false);
    expect('fermentationEnabled' in body).toBe(false);
  });

  it('空にして保存しようとしても送らない（日記を消してしまわない）', async () => {
    const { result } = renderHook(() => useSaveEntryContent(api));

    let saved = true;
    await act(async () => {
      saved = await result.current.save('e-1', '   \n  ');
    });

    expect(saved).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('失敗したら error を立て、保存済みとして扱わない', async () => {
    apiFetch.mockResolvedValue(mockResponse(false, { error: 'boom' }));
    const { result } = renderHook(() => useSaveEntryContent(api));

    let saved = true;
    await act(async () => {
      saved = await result.current.save('e-1', '本文');
    });

    expect(saved).toBe(false);
    expect(result.current.error).toBe(true);
  });

  it('api が無ければ何もしない', async () => {
    const { result } = renderHook(() => useSaveEntryContent(null));

    let saved = true;
    await act(async () => {
      saved = await result.current.save('e-1', '本文');
    });

    expect(saved).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
