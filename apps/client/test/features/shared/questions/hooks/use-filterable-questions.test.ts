import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterableQuestions } from '@/features/shared/questions/hooks/use-filterable-questions';
import type { ApiClient } from '@/lib/api';

/**
 * Issue #490: `app/(protected)/entries/page.tsx` が持っていた絞り込み選択肢の整形を
 * 共有 hook へ移した分の担保。アーカイブ済みと本文が空のものを落とす。
 */
function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function question(over: Record<string, unknown>) {
  return {
    id: 'q',
    currentText: 'テキスト',
    isArchived: false,
    isProposedByOryzae: false,
    isValidatedByUser: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

function jsonResponse(body: unknown): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

describe('useFilterableQuestions', () => {
  beforeEach(() => vi.clearAllMocks());
  // useQuestions の取得継続がテスト環境の破棄後に走ると React が window を触って落ちる。
  // アンマウントしてから保留中のマイクロタスクを流し切る。
  afterEach(async () => {
    cleanup();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('アーカイブ済みと本文が空の問いを除いて返す', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse([
          question({ id: 'q1', currentText: '生きているのか' }),
          question({ id: 'q2', currentText: 'アーカイブ済み', isArchived: true }),
          question({ id: 'q3', currentText: null }),
          question({ id: 'q4', currentText: '' }),
        ]),
      ),
    );
    const { result } = renderHook(() => useFilterableQuestions(createMockApi(fetchImpl)));

    await waitFor(() => expect(result.current.questions).toHaveLength(1));
    expect(result.current.questions[0]).toEqual({ id: 'q1', currentText: '生きているのか' });
  });

  it('api が null なら空配列', () => {
    const { result } = renderHook(() => useFilterableQuestions(null));
    expect(result.current.questions).toEqual([]);
  });
  it('取得中は loading=true（一覧が「0件」と区別してフィルタ行の枠を出せるようにする）', async () => {
    // これが無いと一覧は「まだ取得中」と「問いが0件」を区別できず、届いた瞬間に
    // フィルタ行が挿入されて一覧全体が下へズレる。
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse([question({ id: 'q1', currentText: '問い' })])),
    );
    const { result } = renderHook(() => useFilterableQuestions(createMockApi(fetchImpl)));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.questions).toHaveLength(1);
  });
});
