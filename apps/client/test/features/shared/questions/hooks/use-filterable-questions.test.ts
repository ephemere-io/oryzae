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

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toEqual({ id: 'q1', currentText: '生きているのか' });
  });

  it('api が null なら空配列', () => {
    const { result } = renderHook(() => useFilterableQuestions(null));
    expect(result.current).toEqual([]);
  });
});
