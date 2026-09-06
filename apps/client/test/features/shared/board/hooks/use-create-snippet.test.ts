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

  it('viewType 付き（ボード経由）で POST する', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(true)));
    const { result } = renderHook(() => useCreateSnippet(createMockApi(fetchImpl)));

    await expect(
      result.current({ text: '抜粋', dateKey: '2026-08-03', viewType: 'daily' }),
    ).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/board/snippets', {
      method: 'POST',
      body: JSON.stringify({ text: '抜粋', dateKey: '2026-08-03', viewType: 'daily' }),
    });
  });

  it('viewType なし（エディタの選択から）でも POST する', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(true)));
    const { result } = renderHook(() => useCreateSnippet(createMockApi(fetchImpl)));

    await result.current({ text: '抜粋', dateKey: '2026-08-03' });

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/board/snippets', {
      method: 'POST',
      body: JSON.stringify({ text: '抜粋', dateKey: '2026-08-03' }),
    });
  });

  it('配置位置（x/y）を渡すとそのまま POST に載る', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse(true)));
    const { result } = renderHook(() => useCreateSnippet(createMockApi(fetchImpl)));

    await result.current({
      text: '抜粋',
      dateKey: '2026-08-03',
      viewType: 'daily',
      x: -320,
      y: 480,
    });

    expect(fetchImpl).toHaveBeenCalledWith('/api/v1/board/snippets', {
      method: 'POST',
      body: JSON.stringify({
        text: '抜粋',
        dateKey: '2026-08-03',
        viewType: 'daily',
        x: -320,
        y: 480,
      }),
    });
  });

  it('失敗は false、api が null なら通信せず false', async () => {
    const failing = vi.fn(() => Promise.resolve(jsonResponse(false)));
    const { result: r1 } = renderHook(() => useCreateSnippet(createMockApi(failing)));
    await expect(r1.current({ text: 'x', dateKey: 'd' })).resolves.toBe(false);

    const { result: r2 } = renderHook(() => useCreateSnippet(null));
    await expect(r2.current({ text: 'x', dateKey: 'd' })).resolves.toBe(false);
  });
});
