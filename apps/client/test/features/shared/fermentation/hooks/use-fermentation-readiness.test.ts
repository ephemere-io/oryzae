import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFermentationReadiness } from '@/features/shared/fermentation/hooks/use-fermentation-readiness';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
    status: ok ? 200 : 500,
    // @type-assertion-allowed: テスト用の最小 Response スタブ
  } as Response;
}

describe('useFermentationReadiness', () => {
  let apiFetch: ReturnType<typeof vi.fn>;
  // ApiClient は毎レンダー作り直さない（useAuth が state で保持するのと同じ前提）。
  // 作り直すと api の identity が変わり、effect が回り続ける。
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
    api = createMockApi(apiFetch);
  });

  it('readiness を取得して score / questionCount を返す', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { score: 1.75, questionCount: 3 }));
    const { result } = renderHook(() => useFermentationReadiness(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(apiFetch).toHaveBeenCalledWith('/api/v1/fermentations/readiness');
    expect(result.current.data).toEqual({ score: 1.75, questionCount: 3 });
    expect(result.current.error).toBeNull();
  });

  it('認証確定前 (authLoading) は fetch しない', async () => {
    const { result } = renderHook(() => useFermentationReadiness(api, true));

    await waitFor(() => {
      expect(apiFetch).not.toHaveBeenCalled();
    });
    expect(result.current.data).toBeNull();
  });

  it('api が null なら fetch せず loading を確定させる（瓶は空のまま描ける）', async () => {
    const { result } = renderHook(() => useFermentationReadiness(null, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toBeNull();
  });

  it('エラー応答では data を更新せずエラーを立てる', async () => {
    apiFetch.mockResolvedValue(mockResponse(false, { error: 'boom' }));
    const { result } = renderHook(() => useFermentationReadiness(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
  });

  it('fetch が throw しても loading が張り付かない', async () => {
    apiFetch.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useFermentationReadiness(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).not.toBeNull();
  });

  it('想定外の形（エラーエンベロープ）は 0 に倒す — ゼロ埋めを本物として描かない', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { error: 'unexpected shape' }));
    const { result } = renderHook(() => useFermentationReadiness(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ score: 0, questionCount: 0 });
  });

  it('refresh で再取得する（エントリを書いた直後に瓶を更新できる）', async () => {
    apiFetch
      .mockResolvedValueOnce(mockResponse(true, { score: 0.5, questionCount: 2 }))
      .mockResolvedValueOnce(mockResponse(true, { score: 1.5, questionCount: 2 }));
    const { result } = renderHook(() => useFermentationReadiness(api, false));

    await waitFor(() => {
      expect(result.current.data?.score).toBe(0.5);
    });

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.data?.score).toBe(1.5);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
