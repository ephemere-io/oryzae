import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFermentationReadiness } from '@/features/fermentation/hooks/use-fermentation-readiness';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: fetchImpl,
  };
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

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('api が null かつ auth ロード中なら fetch しない', async () => {
    const { result } = renderHook(() => useFermentationReadiness(null, true));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.readiness).toBeNull();
  });

  it('api が null かつ auth ロード完了なら loading=false で readiness は null', async () => {
    const { result } = renderHook(() => useFermentationReadiness(null, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.readiness).toBeNull();
  });

  it('成功レスポンスで readiness が反映される', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, { totalReadiness: 1.5, questionCount: 3, language: 'ja' }),
    );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useFermentationReadiness(api, false));

    await waitFor(() => {
      expect(result.current.readiness).not.toBeNull();
    });
    expect(result.current.readiness).toEqual({
      totalReadiness: 1.5,
      questionCount: 3,
      language: 'ja',
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/fermentations/readiness');
  });

  it('失敗レスポンスでも loading=false に戻り readiness は null', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, null));
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useFermentationReadiness(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.readiness).toBeNull();
  });

  it('refresh() で再取得できる', async () => {
    apiFetch
      .mockResolvedValueOnce(
        mockResponse(true, { totalReadiness: 0.5, questionCount: 1, language: 'ja' }),
      )
      .mockResolvedValueOnce(
        mockResponse(true, { totalReadiness: 2.7, questionCount: 3, language: 'ja' }),
      );
    const api = createMockApi(apiFetch);

    const { result } = renderHook(() => useFermentationReadiness(api, false));

    await waitFor(() => {
      expect(result.current.readiness?.totalReadiness).toBe(0.5);
    });

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.readiness?.totalReadiness).toBe(2.7);
    });
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
