import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateSnippet } from '@/features/shared/board/hooks/use-create-snippet';
import type { ApiClient } from '@/lib/api';

/**
 * Issue #490: ボード（useBoard.createSnippet）とエディタの選択ツールバーが同じ POST を
 * 別実装で持っていたのを共有 hook に集約した分の担保。
 */
function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(ok: boolean): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve({}) } as Response;
}

describe('useCreateSnippet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('配置位置（x/y）を渡すとそのまま POST に載る（ボードから作るとき）', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(true)));
    const { result } = renderHook(() => useCreateSnippet(createMockApi(fetchImpl)));

    await expect(result.current({ text: '抜粋', x: -320, y: 480 })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/board/snippets', {
      method: 'POST',
      body: JSON.stringify({ text: '抜粋', x: -320, y: 480 }),
    });
  });

  it('本文だけでも POST する（エディタの選択から作るとき）', async () => {
    // ボードは 1 人に 1 枚。「どの日のボードか」を送る必要はもう無い。
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(true)));
    const { result } = renderHook(() => useCreateSnippet(createMockApi(fetchImpl)));

    await result.current({ text: '抜粋' });

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/board/snippets', {
      method: 'POST',
      body: JSON.stringify({ text: '抜粋' }),
    });
  });

  it('失敗は false、api が null なら通信せず false', async () => {
    const failing = vi.fn(() => Promise.resolve(jsonResponse(false)));
    const { result: r1 } = renderHook(() => useCreateSnippet(createMockApi(failing)));
    await expect(r1.current({ text: 'x' })).resolves.toBe(false);

    const { result: r2 } = renderHook(() => useCreateSnippet(null));
    await expect(r2.current({ text: 'x' })).resolves.toBe(false);
  });
});
