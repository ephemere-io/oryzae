import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnreadLetters } from '@/features/shared/fermentation/hooks/use-unread-letters';
import type { ApiClient } from '@/lib/api';

const LAST_SEEN_KEY = 'oryzae_jar_last_seen_at';
const QUESTION_READ_AT_KEY = 'oryzae_question_read_at';

function createApi(body: unknown): ApiClient {
  return {
    baseUrl: '',
    headers: {},
    fetch: vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  };
}

const LETTERS = [
  { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2026-06-01T00:00:00.000Z' },
  { id: 'f2', questionId: 'q2', status: 'completed', createdAt: '2026-06-02T00:00:00.000Z' },
  { id: 'f3', questionId: 'q1', status: 'pending', createdAt: '2026-06-03T00:00:00.000Z' },
];

describe('useUnreadLetters', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // アンマウントしないと、環境が壊された後に fetch が解決して React が更新を走らせる
  // （"window is not defined"）。この repo は setup ファイルを持たないので明示的に呼ぶ。
  afterEach(cleanup);

  it('完了した発酵だけを未読として数える', async () => {
    const api = createApi(LETTERS);

    const { result } = renderHook(() => useUnreadLetters(api, false));

    await waitFor(() => expect(result.current.unreadCount).toBe(2));
    // Issue #363 perf: 未読集計は /fermentations のバルク1回のみ（/questions は叩かない）。
    expect(api.fetch).toHaveBeenCalledWith('/api/v1/fermentations');
    expect(api.fetch).not.toHaveBeenCalledWith('/api/v1/questions');
  });

  it('一度も瓶を見ていない新規ユーザーでも既読に潰れない', async () => {
    const { result } = renderHook(() => useUnreadLetters(createApi(LETTERS), false));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.unreadCount).toBe(2);
  });

  it('未読の手紙が届いている問いの id を返す（Issue #452: 問い一覧の印）', async () => {
    const { result } = renderHook(() => useUnreadLetters(createApi(LETTERS), false));

    await waitFor(() => expect(result.current.unreadCount).toBe(2));
    expect([...result.current.unreadQuestionIds].sort()).toEqual(['q1', 'q2']);
  });

  it('lastSeenAt より前の手紙は数えない（既存ユーザーの既読を引き継ぐ）', async () => {
    localStorage.setItem(LAST_SEEN_KEY, '2026-07-01T00:00:00.000Z');
    const { result } = renderHook(() => useUnreadLetters(createApi(LETTERS), false));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.unreadCount).toBe(0);
  });

  it('createdAt が壊れている行は数えない（消えないバッジを作らない）', async () => {
    const { result } = renderHook(() =>
      useUnreadLetters(
        createApi([{ id: 'x', questionId: 'q1', status: 'completed', createdAt: 'not-a-date' }]),
        false,
      ),
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.unreadCount).toBe(0);
  });

  it('markQuestionRead は開いた問いだけを既読にする（Issue #447）', async () => {
    const { result } = renderHook(() => useUnreadLetters(createApi(LETTERS), false));

    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    act(() => result.current.markQuestionRead('q1'));

    expect(result.current.unreadCount).toBe(1);
    expect([...result.current.unreadQuestionIds]).toEqual(['q2']);
    expect(Object.keys(JSON.parse(localStorage.getItem(QUESTION_READ_AT_KEY) ?? '{}'))).toEqual([
      'q1',
    ]);
  });

  it('同じ問いに複数届いていてもまとめて既読になる（開けない未読を残さない）', async () => {
    const { result } = renderHook(() =>
      useUnreadLetters(
        createApi([
          { id: 'a1', questionId: 'q1', status: 'completed', createdAt: '2026-06-01T00:00:00Z' },
          { id: 'a2', questionId: 'q1', status: 'completed', createdAt: '2026-06-05T00:00:00Z' },
        ]),
        false,
      ),
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    act(() => result.current.markQuestionRead('q1'));

    // 受信箱は問いごとに最新1通しか出さないので、古い方が未読で残ると永久に消せない。
    expect(result.current.unreadCount).toBe(0);
  });

  it('サーバ時刻のズレで createdAt が未来の手紙も、開けば既読になる', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { result } = renderHook(() =>
      useUnreadLetters(
        createApi([{ id: 'skew', questionId: 'q1', status: 'completed', createdAt: future }]),
        false,
      ),
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    act(() => result.current.markQuestionRead('q1'));

    // 「今」で刻むだけだと未来日を追い越せず、消えないバッジになっていた。
    expect(result.current.unreadCount).toBe(0);
  });

  it('発酵一覧の取得より先にタップされても既読を取りこぼさない', async () => {
    const { result } = renderHook(() => useUnreadLetters(createApi(LETTERS), false));

    // letters が空の段階（受信箱側だけが解決している状況）で既読にする。
    act(() => result.current.markQuestionRead('q1'));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect([...result.current.unreadQuestionIds]).toEqual(['q2']);
  });

  it('既読は localStorage に残り、再マウントしても未読に戻らない', async () => {
    const first = renderHook(() => useUnreadLetters(createApi(LETTERS), false));
    await waitFor(() => expect(first.result.current.unreadCount).toBe(2));

    act(() => first.result.current.markQuestionRead('q1'));

    const second = renderHook(() => useUnreadLetters(createApi(LETTERS), false));
    await waitFor(() => expect(second.result.current.unreadCount).toBe(1));
  });

  it('取得前は ready=false で印を出さない', () => {
    const { result } = renderHook(() => useUnreadLetters(null, false));
    expect(result.current.ready).toBe(false);
    expect(result.current.unreadQuestionIds.size).toBe(0);
  });

  it('markAllSeen は届いている手紙をすべて既読にする（PC の瓶）', async () => {
    const { result } = renderHook(() => useUnreadLetters(createApi(LETTERS), false));

    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    act(() => result.current.markAllSeen());

    expect(result.current.unreadCount).toBe(0);
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBeTruthy();
  });

  it('authLoading 中は取得しない', () => {
    const api = createApi(LETTERS);
    renderHook(() => useUnreadLetters(api, true));
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('通信が失敗しても落ちない（未処理 rejection にしない）', async () => {
    const api: ApiClient = {
      baseUrl: '',
      headers: {},
      fetch: vi.fn(() => Promise.reject(new Error('network down'))),
    };

    const { result } = renderHook(() => useUnreadLetters(api, false));

    await waitFor(() => expect(api.fetch).toHaveBeenCalled());
    expect(result.current.unreadCount).toBe(0);
  });

  it('配列でないレスポンスでも 0 のまま（ナビ全体を巻き込まない）', async () => {
    const api = createApi({ error: 'boom' });
    const { result } = renderHook(() => useUnreadLetters(api, false));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.unreadCount).toBe(0);
  });
});
