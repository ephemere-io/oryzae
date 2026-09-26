import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFirstLetter } from '@/features/shared/fermentation/hooks/use-first-letter';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function mockResponse(ok: boolean, body: unknown): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
    // @type-assertion-allowed: テスト用の最小 Response スタブ
  } as Response;
}

describe('useFirstLetter', () => {
  let apiFetch: ReturnType<typeof vi.fn>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
    api = createMockApi(apiFetch);
  });

  it('POST /api/v1/fermentations/first-letter を叩き、fired をそのまま返す', async () => {
    apiFetch.mockResolvedValue(
      mockResponse(true, { fired: true, fermentationResultId: 'f1', questionId: 'q1' }),
    );
    const { result } = renderHook(() => useFirstLetter(api));

    await expect(result.current.requestFirstLetter()).resolves.toEqual({ fired: true });
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/fermentations/first-letter', {
      method: 'POST',
    });
  });

  it('初回でなければ fired=false（サーバが判定するので、漬けるたびに呼んでよい）', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { fired: false, reason: 'not-first' }));
    const { result } = renderHook(() => useFirstLetter(api));

    await expect(result.current.requestFirstLetter()).resolves.toEqual({ fired: false });
  });

  it('エラー応答でも投げず fired=false（漬け込みの体験を壊さない）', async () => {
    apiFetch.mockResolvedValue(mockResponse(false, { error: 'LLM analysis failed' }));
    const { result } = renderHook(() => useFirstLetter(api));

    await expect(result.current.requestFirstLetter()).resolves.toEqual({ fired: false });
  });

  it('fetch が throw しても投げず fired=false', async () => {
    apiFetch.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useFirstLetter(api));

    await expect(result.current.requestFirstLetter()).resolves.toEqual({ fired: false });
  });

  it('想定外の形（エラーエンベロープ）は fired=false に倒す', async () => {
    apiFetch.mockResolvedValue(mockResponse(true, { error: 'unexpected shape' }));
    const { result } = renderHook(() => useFirstLetter(api));

    await expect(result.current.requestFirstLetter()).resolves.toEqual({ fired: false });
  });

  it('api が無ければ叩かずに fired=false', async () => {
    const { result } = renderHook(() => useFirstLetter(null));

    await expect(result.current.requestFirstLetter()).resolves.toEqual({ fired: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
