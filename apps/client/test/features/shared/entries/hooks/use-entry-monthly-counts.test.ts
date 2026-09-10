import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEntryMonthlyCounts } from '@/features/shared/entries/hooks/use-entry-monthly-counts';
import type { ApiClient } from '@/lib/api';

function apiReturning(body: unknown, ok = true): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })),
  };
}

afterEach(cleanup);

describe('useEntryMonthlyCounts', () => {
  it('サーバーの月別件数をそのまま読む', async () => {
    const { result } = renderHook(() =>
      useEntryMonthlyCounts(
        apiReturning([
          { month: '2026-09', count: 11 },
          { month: '2026-08', count: 4 },
        ]),
        false,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toMatchObject([
      { month: '2026-09', count: 11 },
      { month: '2026-08', count: 4 },
    ]);
  });

  it('その月の最初と最後の日を読む（形が違えば null で、件数は残す）', async () => {
    const { result } = renderHook(() =>
      useEntryMonthlyCounts(
        apiReturning([
          { month: '2026-09', count: 3, first: '2026-09-01', last: '2026-09-18' },
          { month: '2026-08', count: 2, first: '8/3', last: null },
        ]),
        false,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toEqual([
      { month: '2026-09', count: 3, first: '2026-09-01', last: '2026-09-18' },
      { month: '2026-08', count: 2, first: null, last: null },
    ]);
  });

  it('取得に失敗しても空配列（机が空になるだけ）', async () => {
    const { result } = renderHook(() => useEntryMonthlyCounts(apiReturning([], false), false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toMatchObject([]);
  });

  it('月の形が違う行だけを捨てる', async () => {
    // 背文字と積みの順序がそのまま壊れるので、形の違う行は通さない。
    const { result } = renderHook(() =>
      useEntryMonthlyCounts(
        apiReturning([
          { month: '2026-09', count: 3 },
          { month: '2026-9', count: 5 },
          { month: 'いつか', count: 5 },
          { month: '2026-08', count: 2 },
        ]),
        false,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toMatchObject([
      { month: '2026-09', count: 3 },
      { month: '2026-08', count: 2 },
    ]);
  });

  it('件数が数値でない・負の行を捨てる', async () => {
    const { result } = renderHook(() =>
      useEntryMonthlyCounts(
        apiReturning([
          { month: '2026-09', count: 'たくさん' },
          { month: '2026-08', count: -1 },
          { month: '2026-07', count: 2 },
        ]),
        false,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toMatchObject([{ month: '2026-07', count: 2 }]);
  });

  it('配列でないレスポンスでも落ちない', async () => {
    for (const body of [{}, null, 'nope']) {
      const { result, unmount } = renderHook(() =>
        useEntryMonthlyCounts(apiReturning(body), false),
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.counts).toMatchObject([]);
      unmount();
    }
  });

  it('タイムゾーンオフセットを送る（月の境界がずれる）', async () => {
    const api = apiReturning([]);
    const { result } = renderHook(() => useEntryMonthlyCounts(api, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const url = vi.mocked(api.fetch).mock.calls[0][0];
    expect(url).toContain('/api/v1/entries/monthly-counts?tzOffset=');
    expect(url).toContain(String(new Date().getTimezoneOffset()));
  });

  it('認証待ちの間は取りに行かない', () => {
    const api = apiReturning([]);
    renderHook(() => useEntryMonthlyCounts(api, true));
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('1 回だけ叩く（書斎を開くたびに全件取得にしない）', async () => {
    const api = apiReturning([]);
    const { result } = renderHook(() => useEntryMonthlyCounts(api, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.fetch).toHaveBeenCalledTimes(1);
  });
});
