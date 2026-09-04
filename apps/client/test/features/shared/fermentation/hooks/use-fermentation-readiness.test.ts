import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFermentationReadiness } from '@/features/shared/fermentation/hooks/use-fermentation-readiness';
import type { ApiClient } from '@/lib/api';

function apiReturning(body: unknown, ok = true): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })),
  };
}

/** 通信そのものが失敗する（オフライン等）。 */
function apiThrowing(): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: vi.fn(async () => {
      throw new Error('offline');
    }),
  };
}

afterEach(cleanup);

describe('useFermentationReadiness', () => {
  it('サーバーの値をそのまま読む', async () => {
    const { result } = renderHook(() =>
      useFermentationReadiness(
        apiReturning({ readiness: 0.62, eligible: false, nextRunAt: '2026-09-05T00:00:00.000Z' }),
        false,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.readiness).toEqual({
      readiness: 0.62,
      eligible: false,
      nextRunAt: '2026-09-05T00:00:00.000Z',
    });
  });

  it('取得に失敗しても idle の見た目で出す（書斎を落とさない）', async () => {
    const { result } = renderHook(() => useFermentationReadiness(apiReturning({}, false), false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.readiness).toEqual({ readiness: 0, eligible: false, nextRunAt: null });
  });

  it('通信が投げても握る', async () => {
    const { result } = renderHook(() => useFermentationReadiness(apiThrowing(), false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.readiness.readiness).toBe(0);
  });

  it('0..1 の外は丸める（液面と泡の数が壊れる）', async () => {
    const over = renderHook(() => useFermentationReadiness(apiReturning({ readiness: 7 }), false));
    await waitFor(() => expect(over.result.current.loading).toBe(false));
    expect(over.result.current.readiness.readiness).toBe(1);
    over.unmount();

    const under = renderHook(() =>
      useFermentationReadiness(apiReturning({ readiness: -3 }), false),
    );
    await waitFor(() => expect(under.result.current.loading).toBe(false));
    expect(under.result.current.readiness.readiness).toBe(0);
    under.unmount();
  });

  it('数値でない readiness を 0 に倒す', async () => {
    const { result } = renderHook(() =>
      useFermentationReadiness(apiReturning({ readiness: 'ほとんど' }), false),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.readiness.readiness).toBe(0);
  });

  it('配列や null が返っても落ちない', async () => {
    for (const body of [[], null, 'nope']) {
      const { result, unmount } = renderHook(() =>
        useFermentationReadiness(apiReturning(body), false),
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.readiness.readiness).toBe(0);
      unmount();
    }
  });

  it('nextRunAt が無ければ null（未発酵は時間ゲートを持たない）', async () => {
    const { result } = renderHook(() =>
      useFermentationReadiness(apiReturning({ readiness: 0.3, eligible: false }), false),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.readiness.nextRunAt).toBeNull();
  });

  it('認証待ちの間は取りに行かない', () => {
    const api = apiReturning({ readiness: 1 });
    renderHook(() => useFermentationReadiness(api, true));
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('api が無ければ取りに行かない', () => {
    expect(() => renderHook(() => useFermentationReadiness(null, false))).not.toThrow();
  });

  it('readiness のエンドポイントを 1 回だけ叩く', async () => {
    const api = apiReturning({ readiness: 0.5 });
    const { result } = renderHook(() => useFermentationReadiness(api, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.fetch).toHaveBeenCalledTimes(1);
    expect(api.fetch).toHaveBeenCalledWith('/api/v1/fermentations/readiness');
  });
});
