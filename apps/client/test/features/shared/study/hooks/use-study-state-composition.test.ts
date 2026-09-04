import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStudyState } from '@/features/shared/study/hooks/use-study-state';
import type { ApiClient } from '@/lib/api';

/**
 * 書斎の状態が「どのエンドポイントを叩いて」「部分的な失敗でどうなるか」を固定する。
 *
 * 個々の hook は各ドメインのテストが見ている。ここで見るのは**束ね方**
 * — とくに「書斎は部分的な失敗で落とさない」（10-data-contract.md）。
 */

afterEach(cleanup);

interface RouteMap {
  [pattern: string]: { body: unknown; ok?: boolean };
}

function apiFor(routes: RouteMap): { api: ApiClient; calls: string[] } {
  const calls: string[] = [];
  const api: ApiClient = {
    baseUrl: '',
    headers: {},
    fetch: vi.fn(async (path: string) => {
      calls.push(path);
      const match = Object.keys(routes).find((pattern) => path.startsWith(pattern));
      if (!match) return new Response('{}', { status: 404 });
      const route = routes[match];
      return new Response(JSON.stringify(route.body), { status: route.ok === false ? 500 : 200 });
    }),
  };
  return { api, calls };
}

const ENTRY = {
  id: 'e-1',
  userId: 'u-1',
  content: '今日は静かだった。ずっと窓の外を見ていた。',
  mediaUrls: [],
  createdAt: '2026-09-02T01:00:00.000Z',
  updatedAt: '2026-09-02T01:00:00.000Z',
  linkedQuestions: [{ id: 'q-1', currentText: '続ける意味とは' }],
};

const HAPPY: RouteMap = {
  '/api/v1/fermentations/readiness': {
    body: { readiness: 0.62, eligible: false, nextRunAt: null },
  },
  '/api/v1/fermentations/': { body: { keywords: [{ id: 'k1', keyword: '余白' }] } },
  '/api/v1/fermentations': { body: [] },
  '/api/v1/questions': { body: [] },
  '/api/v1/entries/monthly-counts': { body: [{ month: '2026-09', count: 11 }] },
  '/api/v1/entries': { body: [ENTRY] },
  '/api/v1/board': { body: { cards: [] } },
};

describe('useStudyState', () => {
  it('必要なものを取りそろえる', async () => {
    const { api, calls } = apiFor(HAPPY);
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(calls.some((c) => c.startsWith('/api/v1/fermentations/readiness'))).toBe(true);
    expect(calls.some((c) => c.startsWith('/api/v1/entries/monthly-counts'))).toBe(true);
    expect(calls.some((c) => c.startsWith('/api/v1/board'))).toBe(true);
  });

  it('readiness をそのまま瓶へ渡す', async () => {
    const { api } = apiFor(HAPPY);
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.fermentation.readiness).toBe(0.62);
    expect(result.current.state.fermentation.status).toBe('fermenting');
  });

  it('月別件数から手帳を作り、当月に印を付ける', async () => {
    const { api } = apiFor(HAPPY);
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const notebook = result.current.state.notebooks.find((n) => n.month === '2026-09');
    expect(notebook?.entryCount).toBe(11);
    // 当月かどうかは実行時の「今」で決まる。now と一致していること。
    expect(notebook?.current).toBe(result.current.state.now.slice(0, 7) === '2026-09');
  });

  it('記録を一覧用の形に落とす（本文全体は持たない）', async () => {
    const { api } = apiFor(HAPPY);
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    const entry = result.current.state.entries[0];
    expect(entry.excerpt).toBe('今日は静かだった。');
    expect(entry.chars).toBe(ENTRY.content.length);
    expect(entry.pickled).toBe(true);
  });

  it('未読件数は context から取る（発酵を取り直さない）', async () => {
    // provider を張っていないので既定値の 0。ここで見たいのは「自分で数えない」こと。
    const { api, calls } = apiFor(HAPPY);
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.unreadCount).toBe(0);
    // 受信箱のための 1 回はあってよいが、それ以上に増えていないこと。
    const fermentationList = calls.filter((c) => c === '/api/v1/fermentations');
    expect(fermentationList.length).toBeLessThanOrEqual(1);
  });

  it('board が 500 でも書斎は成立する（壁が空になるだけ）', async () => {
    const { api } = apiFor({ ...HAPPY, '/api/v1/board': { body: {}, ok: false } });
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.board.cards).toEqual([]);
    expect(result.current.state.fermentation.readiness).toBe(0.62);
  });

  it('readiness が 500 でも瓶は idle で出る', async () => {
    const { api } = apiFor({
      ...HAPPY,
      '/api/v1/fermentations/readiness': { body: {}, ok: false },
    });
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.fermentation.readiness).toBe(0);
    expect(result.current.state.fermentation.status).toBe('idle');
  });

  it('月別件数が 500 でも机は空で出る', async () => {
    const { api } = apiFor({
      ...HAPPY,
      '/api/v1/entries/monthly-counts': { body: [], ok: false },
    });
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.notebooks).toEqual([]);
  });

  it('now がローカル暦日の形になっている', async () => {
    const { api } = apiFor(HAPPY);
    const { result } = renderHook(() => useStudyState(api, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state.now).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('api が無くても落ちない', () => {
    expect(() => renderHook(() => useStudyState(null, true))).not.toThrow();
  });
});
