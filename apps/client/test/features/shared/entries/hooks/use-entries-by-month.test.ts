import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEntriesByMonth } from '@/features/shared/entries/hooks/use-entries-by-month';
import type { ApiClient } from '@/lib/api';

/**
 * 書斎の一覧が「古い月を選ぶと必ず空」だった穴（60-implementation-notes.md §9）の担保。
 * 直近 20 件を手元で絞るのではなく、月をサーバーへ渡して絞ってもらう。
 */

function entry(id: string, createdAt: string) {
  return {
    id,
    userId: 'u-1',
    content: `本文 ${id}`,
    mediaUrls: [],
    createdAt,
    updatedAt: createdAt,
    linkedQuestions: [],
  };
}

function apiReturning(pages: unknown[][]): { api: ApiClient; urls: string[] } {
  const urls: string[] = [];
  let call = 0;
  const api: ApiClient = {
    baseUrl: '',
    headers: {},
    fetch: (path) => {
      urls.push(path);
      const body = pages[call] ?? [];
      call++;
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    },
  };
  return { api, urls };
}

describe('useEntriesByMonth', () => {
  it('月を指定しなければ何も取りに行かない', () => {
    const { api, urls } = apiReturning([[]]);
    const { result } = renderHook(() => useEntriesByMonth(api, null));
    expect(urls).toEqual([]);
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('月をサーバーへ渡して絞ってもらう（手元で絞らない）', async () => {
    const { api, urls } = apiReturning([[entry('e-1', '2026-04-03T00:00:00.000Z')]]);
    const { result } = renderHook(() => useEntriesByMonth(api, '2026-04'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(urls[0]).toContain('month=2026-04');
  });

  it('件数と同じ月の切り方になるよう tzOffset を送る', () => {
    // これが無いと、JST の月初 00:00〜09:00 に書いた記録が前月に落ち、
    // 手帳の厚みが言う件数と一覧が食い違う。
    const { api, urls } = apiReturning([[]]);
    renderHook(() => useEntriesByMonth(api, '2026-04'));
    expect(urls[0]).toContain('tzOffset=');
  });

  it('1 ページに収まらない月は続きも取る', async () => {
    const full = Array.from({ length: 100 }, (_, i) =>
      entry(`e-${i}`, `2026-04-${`${(i % 28) + 1}`.padStart(2, '0')}T00:00:00.000Z`),
    );
    const { api, urls } = apiReturning([full, [entry('e-x', '2026-04-01T00:00:00.000Z')]]);
    const { result } = renderHook(() => useEntriesByMonth(api, '2026-04'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(101);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('cursor=');
  });

  it('ちょうど収まったら次を取りに行かない（往復を増やさない）', async () => {
    const { api, urls } = apiReturning([[entry('e-1', '2026-04-03T00:00:00.000Z')]]);
    const { result } = renderHook(() => useEntriesByMonth(api, '2026-04'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(urls).toHaveLength(1);
  });

  it('月を切り替えたら前の月の記録を出さない', async () => {
    const { api } = apiReturning([
      [entry('april', '2026-04-03T00:00:00.000Z')],
      [entry('may', '2026-05-03T00:00:00.000Z')],
    ]);
    const { result, rerender } = renderHook(({ month }) => useEntriesByMonth(api, month), {
      initialProps: { month: '2026-04' },
    });
    await waitFor(() => expect(result.current.entries).toHaveLength(1));

    rerender({ month: '2026-05' });
    // 取りに行っている間は空。前の月の記録が新しい月の見出しの下に並ばない。
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries[0]?.id).toBe('may');
  });

  it('取れなければ error を立てて、読み込み中のまま固まらない', async () => {
    const api: ApiClient = {
      baseUrl: '',
      headers: {},
      fetch: () => Promise.resolve(new Response('{}', { status: 429 })),
    };
    const { result } = renderHook(() => useEntriesByMonth(api, '2026-04'));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
  });

  it('例外でも固まらない', async () => {
    const api: ApiClient = {
      baseUrl: '',
      headers: {},
      fetch: vi.fn(() => Promise.reject(new Error('offline'))),
    };
    const { result } = renderHook(() => useEntriesByMonth(api, '2026-04'));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
  });

  it('api が無ければ取りに行かない', () => {
    const { result } = renderHook(() => useEntriesByMonth(null, '2026-04'));
    expect(result.current.entries).toEqual([]);
  });
});
