import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useJarQuestions } from '@/features/shared/questions/hooks/use-jar-questions';
import type { ApiClient } from '@/lib/api';

/**
 * Issue #490: `app/(protected)/jar/page.tsx` が直叩きしていた /questions 取得を
 * 共有 hook へ移した分の担保。取得・再取得・authLoading ゲートを固定する。
 */
function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

const questions = [{ id: 'q1', currentText: 'なぜ書くのか', jarX: 10, jarY: 20 }];

describe('useJarQuestions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('座標つきのアクティブな問いを取得する', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(questions)));
    const { result } = renderHook(() => useJarQuestions(createMockApi(fetchImpl), false));

    await waitFor(() => expect(result.current.questions).toHaveLength(1));
    expect(result.current.questions[0].jarX).toBe(10);
    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/questions');
  });

  it('authLoading 中は取得しない', () => {
    const fetchImpl = vi.fn();
    renderHook(() => useJarQuestions(createMockApi(fetchImpl), true));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('api が null なら取得しない', () => {
    renderHook(() => useJarQuestions(null, false));
    // 例外なく空配列で始まること（page 側が問い追加後に refetch する）
  });

  it('refetch で取り直せる（問い追加・編集・終了の後に呼ばれる）', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(questions)));
    const api = createMockApi(fetchImpl);
    const { result } = renderHook(() => useJarQuestions(api, false));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.refetch();
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('ok=false なら前回の内容を保つ（画面を空にしない）', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(null, false)));
    const { result } = renderHook(() => useJarQuestions(createMockApi(fetchImpl), false));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(result.current.questions).toEqual([]);
  });
});
