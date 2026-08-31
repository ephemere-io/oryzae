import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFermentationDetail } from '@/features/shared/fermentation/hooks/use-fermentation-detail';
import type { ApiClient } from '@/lib/api';

/**
 * Issue #490: SP の瓶が使っていた「id で発酵詳細を取る」hook を shared へ移した。
 * 統合前は素通し（letter?.bodyText を読むだけ）だったが、PC 側の厳しい正規化に寄せている。
 * サーバの GET /api/v1/fermentations/:id は id / questionId / status と
 * letter{id,bodyText,jarX,jarY} を返す（apps/server の fermentations ルート）。
 */
function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

describe('useFermentationDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('発酵詳細から手紙・言葉・抜粋を取り出す', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          id: 'f1',
          questionId: 'q1',
          targetPeriod: '2024-02',
          status: 'completed',
          letter: { id: 'l1', bodyText: 'こんにちは、過去の自分より', jarX: null, jarY: null },
          keywords: [{ id: 'k1', keyword: '余白', description: '...' }],
          snippets: [{ id: 's1', originalText: 'うまく言えない', sourceDate: '2024-02-01' }],
        }),
      ),
    );
    const api = createMockApi(fetchImpl);
    const { result } = renderHook(() => useFermentationDetail(api, 'f1'));

    await waitFor(() =>
      expect(result.current.detail?.letter?.bodyText).toBe('こんにちは、過去の自分より'),
    );
    expect(result.current.detail?.keywords).toHaveLength(1);
    expect(result.current.detail?.keywords[0].keyword).toBe('余白');
    expect(result.current.detail?.snippets).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/fermentations/f1');
  });

  it('letter / keywords / snippets が無ければ空で返す', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse({ id: 'f1', questionId: 'q1', letter: null })),
    );
    const api = createMockApi(fetchImpl);
    const { result } = renderHook(() => useFermentationDetail(api, 'f1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail?.letter).toBeNull();
    expect(result.current.detail?.keywords).toEqual([]);
    expect(result.current.detail?.snippets).toEqual([]);
  });

  it('id / questionId を欠く不正なレスポンスは null に落とす', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ letter: null })));
    const api = createMockApi(fetchImpl);
    const { result } = renderHook(() => useFermentationDetail(api, 'f1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail).toBeNull();
  });

  it('fermentationId が null なら fetch しない', () => {
    const fetchImpl = vi.fn();
    const api = createMockApi(fetchImpl);
    renderHook(() => useFermentationDetail(api, null));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
