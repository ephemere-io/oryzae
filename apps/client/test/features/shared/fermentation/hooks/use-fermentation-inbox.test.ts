import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFermentationInbox } from '@/features/shared/fermentation/hooks/use-fermentation-inbox';
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

  // アンマウントしないと、環境が壊された後に fetch が解決して React が更新を走らせる
  // （"window is not defined"）。この repo は setup ファイルを持たないので明示的に呼ぶ。
  afterEach(cleanup);

  it('完了した発酵のある問いだけを未読として返す（バルク取得・問いごとに最新1件）', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(
          jsonResponse([
            { id: 'q1', currentText: '問いA' },
            { id: 'q2', currentText: '問いB' },
          ]),
        );
      // Issue #363 perf: 全発酵を1回で取得（questionId なし）。問いごとの個別 fetch はしない。
      if (url === '/api/v1/fermentations')
        return Promise.resolve(
          jsonResponse([
            { id: 'f0', questionId: 'q1', status: 'completed', createdAt: '2024-01-01T00:00:00Z' },
            { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2024-02-01T00:00:00Z' },
            // q2 は running のみ → 受信箱に出ない
            { id: 'f2', questionId: 'q2', status: 'running', createdAt: '2024-03-01T00:00:00Z' },
          ]),
        );
      throw new Error(`unexpected fetch: ${url}`);
    });

    const api = createMockApi(fetchImpl);
    const { result } = renderHook(() => useFermentationInbox(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // N+1 解消: 問いごとの /fermentations?questionId= は呼ばれない。
    expect(fetchImpl).not.toHaveBeenCalledWith('/api/v1/fermentations?questionId=q1');
    expect(result.current.letters).toHaveLength(1);
    expect(result.current.letters[0]).toMatchObject({
      questionId: 'q1',
      questionText: '問いA',
      fermentationId: 'f1', // q1 の最新の完了発酵
    });
    // Issue #447: 既読/未読は受信箱では決めない（use-unread-letters に一本化）。
    expect(result.current.letters[0]).not.toHaveProperty('unread');
  });

  it('authLoading 中は取得しない', () => {
    const fetchImpl = vi.fn();
    const api = createMockApi(fetchImpl);
    renderHook(() => useFermentationInbox(api, true));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('問い一覧に無い問いの手紙も落とさない（開けない未読を作らない）', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions') return Promise.resolve(jsonResponse([]));
      if (url === '/api/v1/fermentations')
        return Promise.resolve(
          jsonResponse([
            {
              id: 'f9',
              questionId: 'gone',
              status: 'completed',
              createdAt: '2026-05-01T00:00:00Z',
            },
          ]),
        );
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useFermentationInbox(createMockApi(fetchImpl), false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.letters).toHaveLength(1);
    expect(result.current.letters[0]).toMatchObject({
      questionId: 'gone',
      questionText: null,
      fermentationId: 'f9',
    });
  });

  it('問い一覧が配列でなくても落ちない', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions') return Promise.resolve(jsonResponse({ error: 'boom' }));
      if (url === '/api/v1/fermentations')
        return Promise.resolve(
          jsonResponse([
            { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2026-05-01T00:00:00Z' },
          ]),
        );
      throw new Error(`unexpected fetch: ${url}`);
    });

    const { result } = renderHook(() => useFermentationInbox(createMockApi(fetchImpl), false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // 見出しが取れなくても手紙自体は開けるようにする（問いの本文は null）。
    expect(result.current.letters).toHaveLength(1);
    expect(result.current.letters[0].questionText).toBeNull();
  });

  it('通信が失敗しても loading が張り付かない', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('network down')));
    const api = createMockApi(fetchImpl);

    const { result } = renderHook(() => useFermentationInbox(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.letters).toEqual([]);
  });
});
