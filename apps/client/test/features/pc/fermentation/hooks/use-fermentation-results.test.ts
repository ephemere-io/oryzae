import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type FermentationDetail,
  useFermentationForQuestion,
} from '@/features/pc/fermentation/hooks/use-fermentation-results';
import type { ApiClient } from '@/lib/api';

/**
 * characterization test（#434 リファクタ前の現挙動固定）。
 * use-fermentation-results（useFermentationForQuestion）は shared/fermentation へ移設予定。
 * 移設後も同一アサーションが通ることで「一覧取得→completed の詳細取得」挙動の不変を保証する。
 */
function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

const detail: FermentationDetail = {
  id: 'f-1',
  questionId: 'q-1',
  targetPeriod: '2026-02',
  status: 'completed',
  worksheet: null,
  snippets: [],
  letter: null,
  keywords: [],
};

describe('useFermentationForQuestion', () => {
  it('questionId の一覧を取得し、completed の詳細を読み込む', async () => {
    const summaries = [
      { id: 'f-old', questionId: 'q-1', status: 'processing', createdAt: '2026-01-01' },
      { id: 'f-1', questionId: 'q-1', status: 'completed', createdAt: '2026-02-01' },
    ];
    const apiFetch = vi.fn();
    apiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/v1/fermentations?questionId=q-1') {
        return { ok: true, json: async () => summaries };
      }
      if (path === '/api/v1/fermentations/f-1') {
        return { ok: true, json: async () => detail };
      }
      throw new Error(`unexpected path: ${path}`);
    });

    // api は context 由来で参照安定（実アプリと同条件）。毎レンダー再生成すると
    // useCallback の deps が変わり effect が再発火するため、参照を固定する。
    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationForQuestion(api, 'q-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toEqual(summaries);
    expect(result.current.detail).toEqual(detail);
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/fermentations?questionId=q-1');
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/fermentations/f-1');
  });

  it('completed が無ければ詳細は取得せず detail は null', async () => {
    const summaries = [
      { id: 'f-1', questionId: 'q-1', status: 'processing', createdAt: '2026-02-01' },
    ];
    const apiFetch = vi.fn();
    apiFetch.mockResolvedValue({ ok: true, json: async () => summaries });

    const api = createMockApi(apiFetch);
    const { result } = renderHook(() => useFermentationForQuestion(api, 'q-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail).toBeNull();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('api が null / questionId undefined のときは fetch しない', () => {
    const apiFetch = vi.fn();
    const api = createMockApi(apiFetch);
    renderHook(() => useFermentationForQuestion(null, 'q-1'));
    renderHook(() => useFermentationForQuestion(api, undefined));
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
