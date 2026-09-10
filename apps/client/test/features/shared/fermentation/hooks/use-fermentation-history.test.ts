import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFermentationHistory } from '@/features/shared/fermentation/hooks/use-fermentation-history';
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

/** API は created_at 降順で返す。順序に依存していないことを見るため意図的に混ぜる。 */
const MIXED = [
  {
    id: 'f-b',
    questionId: 'q1',
    status: 'completed',
    createdAt: '2026-07-20',
    targetPeriod: 'WEEK 29',
  },
  {
    id: 'f-a',
    questionId: 'q1',
    status: 'completed',
    createdAt: '2026-06-15',
    targetPeriod: 'WEEK 24',
  },
  {
    id: 'f-c',
    questionId: 'q1',
    status: 'completed',
    createdAt: '2026-08-31',
    targetPeriod: 'WEEK 35',
  },
  {
    id: 'g-a',
    questionId: 'q2',
    status: 'completed',
    createdAt: '2026-07-06',
    targetPeriod: 'WEEK 27',
  },
];

describe('useFermentationHistory', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn();
  });

  it('api が null なら fetch せず空で返す', async () => {
    const { result } = renderHook(() => useFermentationHistory(null, false));
    expect(result.current.byQuestion.size).toBe(0);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('authLoading 中は fetch しない', async () => {
    const api = createMockApi(apiFetch);
    renderHook(() => useFermentationHistory(api, true));
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('問いごとに古い順（末尾が最新）で束ねる', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, MIXED));
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationHistory(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 一覧はユーザー全件を 1 回だけ（questionId ごとの N+1 にしない）。
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/fermentations');

    const q1 = result.current.byQuestion.get('q1');
    expect(q1?.map((s) => s.id)).toEqual(['f-a', 'f-b', 'f-c']);
    expect(result.current.byQuestion.get('q2')?.map((s) => s.id)).toEqual(['g-a']);
  });

  it('targetPeriod を拾う（円盤の期間ラベルに使う）', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, MIXED));
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationHistory(api, false));

    await waitFor(() => {
      expect(result.current.byQuestion.size).toBeGreaterThan(0);
    });

    expect(result.current.byQuestion.get('q1')?.map((s) => s.targetPeriod)).toEqual([
      'WEEK 24',
      'WEEK 29',
      'WEEK 35',
    ]);
  });

  it('completed 以外は落とす', async () => {
    apiFetch.mockResolvedValueOnce(
      mockResponse(true, [
        { id: 'f1', questionId: 'q1', status: 'pending', createdAt: '2026-01-01' },
        { id: 'f2', questionId: 'q1', status: 'failed', createdAt: '2026-01-02' },
        { id: 'f3', questionId: 'q1', status: 'completed', createdAt: '2026-01-03' },
      ]),
    );
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationHistory(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.byQuestion.get('q1')?.map((s) => s.id)).toEqual(['f3']);
  });

  it('配列でないレスポンス（エラーエンベロープ等）でも落ちない', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(true, { error: 'boom' }));
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationHistory(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.byQuestion.size).toBe(0);
  });

  it('ok=false でも loading は必ず解ける', async () => {
    apiFetch.mockResolvedValueOnce(mockResponse(false, null));
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationHistory(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.byQuestion.size).toBe(0);
  });

  it('fetch が reject しても loading は解け、瓶は空の履歴で成立する', async () => {
    apiFetch.mockRejectedValueOnce(new Error('network down'));
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationHistory(api, false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.byQuestion.size).toBe(0);
  });
});
