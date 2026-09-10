import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api';
import { jsonResponse, textResponse } from '../helpers/response';

/**
 * 同じ GET を短いあいだ憶える（画面の行き来を跨ぐ長さ）。
 *
 * 瓶や書斎は開くたびに同じ口を叩いていて（`/api/v1/fermentations` は受信箱と履歴の
 * 2 か所、`/api/v1/questions` は瓶と書斎）、行き来のたびに待ち時間が生まれていた
 * （「瓶の画面も開くたびにロードされていて、表示までに結構タイムラグがある」）。
 *
 * ここで固定するのは「憶える」ことより、**憶えてはいけないもの**のほう。
 */
describe('createApiClient: GET の憶え', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('同じ GET は 1 回しか出さず、2 回目も本文を読める', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse([{ id: 'q1' }]));
    const api = createApiClient('at-1');

    const first = await (await api.fetch('/api/v1/questions')).json();
    const second = await (await api.fetch('/api/v1/questions')).json();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first).toEqual([{ id: 'q1' }]);
    // 2 人目にも自分ぶんの本文が渡ること（同じ Response を 2 人で読めない）。
    expect(second).toEqual([{ id: 'q1' }]);
  });

  it('同時に叩いても口は 1 本（受信箱と履歴が同じ発酵一覧を見に行く）', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse([{ id: 'f1' }]));
    const api = createApiClient('at-1');

    const [a, b] = await Promise.all([
      api.fetch('/api/v1/fermentations'),
      api.fetch('/api/v1/fermentations'),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await a.json()).toEqual([{ id: 'f1' }]);
    expect(await b.json()).toEqual([{ id: 'f1' }]);
  });

  it('書き込みのあとは憶えを捨てる（問いを足したら瓶に出る）', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse([{ id: 'q1' }]));
    const api = createApiClient('at-1');

    await api.fetch('/api/v1/questions');
    await api.fetch('/api/v1/questions', { method: 'POST', body: '{}' });
    await api.fetch('/api/v1/questions');

    // GET → POST → GET の 3 本。最後の GET が憶えから返ると、足した問いが出ない。
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('時間が経てば取り直す', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse([{ id: 'q1' }]));
    const api = createApiClient('at-1');

    await api.fetch('/api/v1/questions');
    vi.advanceTimersByTime(31_000);
    await api.fetch('/api/v1/questions');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('認証の口は憶えない（失効に気づけなくなる）', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse({ user: { id: 'u1' } }));
    const api = createApiClient('at-1');

    await api.fetch('/api/v1/auth/me');
    await api.fetch('/api/v1/auth/me');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('失敗した返事は憶えない（次に開いたときも空のまま出る）', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse({ error: 'boom' }, 500));
    const api = createApiClient('at-1');

    await api.fetch('/api/v1/questions');
    await api.fetch('/api/v1/questions');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('JSON でない返事は憶えない（本文を text にして貯めるので壊れる）', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => textResponse('plain'));
    const api = createApiClient('at-1');

    await api.fetch('/api/v1/entries/export');
    await api.fetch('/api/v1/entries/export');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('別の口は別に憶える', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse([{ id: 'x' }]));
    const api = createApiClient('at-1');

    await api.fetch('/api/v1/questions');
    await api.fetch('/api/v1/questions/all');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
