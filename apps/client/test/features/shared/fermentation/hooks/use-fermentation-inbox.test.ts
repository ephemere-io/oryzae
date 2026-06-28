import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useFermentationDetail,
  useFermentationInbox,
} from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
import type { ApiClient } from '@/lib/api';

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

describe('useFermentationInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('完了した発酵のある問いだけを未読として返す', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(
          jsonResponse([
            { id: 'q1', currentText: '問いA' },
            { id: 'q2', currentText: '問いB' },
          ]),
        );
      if (url === '/api/v1/fermentations?questionId=q1')
        return Promise.resolve(
          jsonResponse([
            { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2024-02-01T00:00:00Z' },
          ]),
        );
      // q2 は running のみ → 受信箱に出ない
      return Promise.resolve(
        jsonResponse([
          { id: 'f2', questionId: 'q2', status: 'running', createdAt: '2024-03-01T00:00:00Z' },
        ]),
      );
    });

    const api = createMockApi(fetchImpl);
    const { result } = renderHook(() => useFermentationInbox(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.letters).toHaveLength(1);
    expect(result.current.letters[0]).toMatchObject({
      questionId: 'q1',
      questionText: '問いA',
      fermentationId: 'f1',
      unread: true,
    });
  });

  it('authLoading 中は取得しない', () => {
    const fetchImpl = vi.fn();
    const api = createMockApi(fetchImpl);
    renderHook(() => useFermentationInbox(api, true));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('useFermentationDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('発酵詳細から手紙・言葉・抜粋を取り出す', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          letter: { bodyText: 'こんにちは、過去の自分より' },
          keywords: [{ id: 'k1', keyword: '余白', description: '...' }],
          snippets: [{ id: 's1', originalText: 'うまく言えない', sourceDate: '2024-02-01' }],
        }),
      ),
    );
    const api = createMockApi(fetchImpl);
    const { result } = renderHook(() => useFermentationDetail(api, 'f1'));
    await waitFor(() => expect(result.current.detail?.bodyText).toBe('こんにちは、過去の自分より'));
    expect(result.current.detail?.keywords).toHaveLength(1);
    expect(result.current.detail?.keywords[0].keyword).toBe('余白');
    expect(result.current.detail?.snippets).toHaveLength(1);
  });

  it('letter / keywords / snippets が無ければ空で返す', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ letter: null })));
    const api = createMockApi(fetchImpl);
    const { result } = renderHook(() => useFermentationDetail(api, 'f1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail?.bodyText).toBeNull();
    expect(result.current.detail?.keywords).toEqual([]);
    expect(result.current.detail?.snippets).toEqual([]);
  });

  it('fermentationId が null なら fetch しない', () => {
    const fetchImpl = vi.fn();
    const api = createMockApi(fetchImpl);
    renderHook(() => useFermentationDetail(api, null));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
