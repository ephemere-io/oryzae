import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudyState } from '@/features/shared/study/hooks/use-study-state';
import type { ApiClient } from '@/lib/api';

/**
 * 書斎の状態が「どのエンドポイントを叩いて」「部分的な失敗でどうなるか」を固定する。
 *
 * 個々の hook は各ドメインのテストが見ている。ここで見るのは**束ね方**
 * — とくに「書斎は部分的な失敗で落とさない」（10-data-contract.md）。
 */

afterEach(cleanup);
beforeEach(() => localStorage.clear());

interface RouteMap {
  /** `delayMs` を付けた経路は 1 往復ぶん遅れて返る（二段構えの取得を再現する）。 */
  [pattern: string]: { body: unknown; ok?: boolean; delayMs?: number };
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
      if (route.delayMs) await new Promise((resolve) => setTimeout(resolve, route.delayMs));
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

/**
 * 言葉（瓶に浮かぶキーワード）は二段構えで取る: まず手紙の一覧、その各詳細。
 * 一段目が終わった時点を「取得済み」と数えると、二段目の待ち時間だけ言葉がゼロになる。
 */
const WITH_LETTERS: RouteMap = {
  ...HAPPY,
  '/api/v1/fermentations/readiness': {
    body: { readiness: 0.62, eligible: false, nextRunAt: null },
  },
  // 詳細（/fermentations/:id）。HAPPY の同じ鍵を差し替える（前方一致なので順序が効く）。
  // 一覧より遅らせるのが肝。実物も「一覧が返ってから詳細を引く」ので、ここが同時に
  // 返ってしまうと二段構えの穴（言葉がいったん消える）が再現しない。
  '/api/v1/fermentations/': {
    delayMs: 150,
    body: {
      id: 'f-1',
      questionId: 'q-1',
      targetPeriod: '2026-08',
      status: 'completed',
      keywords: [{ id: 'k-1', keyword: '余白', description: '' }],
      snippets: [],
      letter: null,
    },
  },
  '/api/v1/fermentations': {
    body: [
      { id: 'f-1', questionId: 'q-1', status: 'completed', createdAt: '2026-08-31T00:00:00.000Z' },
    ],
  },
  '/api/v1/questions': { body: [{ id: 'q-1', currentText: '続ける意味とは' }] },
};

describe('前回の書斎を憶えて即座に出す', () => {
  const USER = 'u-1';

  it('憶えた言葉が、取得の途中でいったん消えない', async () => {
    // 1 回目: 取得して憶える。
    const first = apiFor(WITH_LETTERS);
    const a = renderHook(() => useStudyState(first.api, false, USER));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    // 語は出どころの問いと一緒に運ぶ（瓶の中の語が何を指すか触れて分かるように）。
    expect(a.result.current.state.words).toEqual([{ text: '余白', question: '続ける意味とは' }]);
    a.unmount();

    // 2 回目: 描画のたびに言葉の数を記録する。**一度出た言葉が消えないこと**を見る
    // （実機で「言葉が出た後に消えて、1 秒ほどして また出る」として出ていた）。
    // 憶えた値を読むのは effect なので、それより前の初回描画がゼロなのは正常。
    const second = apiFor(WITH_LETTERS);
    const seen: number[] = [];
    const b = renderHook(() => {
      const value = useStudyState(second.api, false, USER);
      seen.push(value.state.words.length);
      return value;
    });
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    const firstShown = seen.findIndex((count) => count > 0);
    expect(firstShown).toBeGreaterThanOrEqual(0);
    expect(seen.slice(firstShown).filter((count) => count === 0)).toEqual([]);
    expect(b.result.current.state.words).toEqual([{ text: '余白', question: '続ける意味とは' }]);
  });

  it('取得が終わったら憶える', async () => {
    const { api } = apiFor(HAPPY);
    const { result } = renderHook(() => useStudyState(api, false, USER));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const raw = localStorage.getItem(`oryzae_cache:study:${USER}`);
    expect(raw).not.toBeNull();
    expect(raw).toContain('2026-09');
  });

  it('次に開いたとき、取得を待たずに前回の中身が出る', async () => {
    // 1 回目: 取得して憶える。
    const first = apiFor(HAPPY);
    const a = renderHook(() => useStudyState(first.api, false, USER));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    const remembered = a.result.current.state.notebooks;
    a.unmount();

    // 2 回目: まだ取得中の時点で、前回の手帳とカードが出ていること。
    // これが無いと、開くたびに空の机と空の壁がいったん出る。
    const second = apiFor(HAPPY);
    const b = renderHook(() => useStudyState(second.api, false, USER));
    await waitFor(() => expect(b.result.current.state.notebooks.length).toBeGreaterThan(0));
    expect(b.result.current.state.notebooks).toEqual(remembered);
  });

  it('取りに行って届かなかったら、前回の書斎をそのまま出す', async () => {
    // 1 回目: 取得して憶える。
    const first = apiFor(WITH_LETTERS);
    const a = renderHook(() => useStudyState(first.api, false, USER));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    const remembered = a.result.current.state;
    expect(remembered.notebooks.length).toBeGreaterThan(0);
    a.unmount();

    // 2 回目: 全部 429（レート制限）。空の部屋ではなく、憶えていた書斎が出ること。
    const blocked: RouteMap = Object.fromEntries(
      Object.keys(WITH_LETTERS).map((pattern) => [pattern, { body: {}, ok: false }]),
    );
    const blockedApi = apiFor(blocked).api;
    const b = renderHook(() => useStudyState(blockedApi, false, USER));
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    expect(b.result.current.state.notebooks).toEqual(remembered.notebooks);
    expect(b.result.current.state.words).toEqual(remembered.words);
  });

  it('届かなかったときは憶えている中身を上書きしない', async () => {
    const first = apiFor(WITH_LETTERS);
    const a = renderHook(() => useStudyState(first.api, false, USER));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    const before = localStorage.getItem(`oryzae_cache:study:${USER}`);
    a.unmount();

    const blocked: RouteMap = Object.fromEntries(
      Object.keys(WITH_LETTERS).map((pattern) => [pattern, { body: {}, ok: false }]),
    );
    const blockedApi = apiFor(blocked).api;
    const b = renderHook(() => useStudyState(blockedApi, false, USER));
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    // 空で塗り潰すと、次に開いたときも空になる。
    expect(localStorage.getItem(`oryzae_cache:study:${USER}`)).toBe(before);
  });

  it('本当に空なら空で出す（憶えた中身を出し続けない）', async () => {
    const first = apiFor(WITH_LETTERS);
    const a = renderHook(() => useStudyState(first.api, false, USER));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    a.unmount();

    // 200 で空を返す＝「取れたうえで何も無い」。ここは憶えた中身に頼ってはいけない。
    const emptied: RouteMap = {
      ...WITH_LETTERS,
      '/api/v1/fermentations': { body: [] },
      '/api/v1/entries/monthly-counts': { body: [] },
      '/api/v1/entries': { body: [] },
    };
    const emptiedApi = apiFor(emptied).api;
    const b = renderHook(() => useStudyState(emptiedApi, false, USER));
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    expect(b.result.current.state.words).toEqual([]);
    expect(b.result.current.state.entries).toEqual([]);
  });

  it('利用者が違えば前の人の中身を出さない', async () => {
    const first = apiFor(HAPPY);
    const a = renderHook(() => useStudyState(first.api, false, USER));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    a.unmount();

    const second = apiFor({ ...HAPPY, '/api/v1/entries/monthly-counts': { body: [] } });
    const b = renderHook(() => useStudyState(second.api, false, 'someone-else'));
    // 取得前の時点で前の人の手帳が出ていないこと。
    expect(b.result.current.state.notebooks).toEqual([]);
  });

  it('利用者が分からなければ憶えない', async () => {
    const { api } = apiFor(HAPPY);
    const { result } = renderHook(() => useStudyState(api, false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(localStorage.getItem('oryzae_cache:study:null')).toBeNull();
  });

  it('日付は憶えた値を使わない（日をまたいでも当月がずれない）', async () => {
    const first = apiFor(HAPPY);
    const a = renderHook(() => useStudyState(first.api, false, USER));
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    // 憶えた値の日付を古いものに書き換える。
    const key = `oryzae_cache:study:${USER}`;
    const envelope = JSON.parse(localStorage.getItem(key) ?? '{}');
    envelope.value.now = '2020-01-01';
    localStorage.setItem(key, JSON.stringify(envelope));
    a.unmount();

    const second = apiFor(HAPPY);
    const b = renderHook(() => useStudyState(second.api, false, USER));
    expect(b.result.current.state.now).not.toBe('2020-01-01');
    expect(b.result.current.state.now).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
