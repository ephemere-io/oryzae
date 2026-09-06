import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ActualCostResult,
  fetchActualCost,
  formatActualCost,
} from '@/contexts/shared/infrastructure/anthropic-cost-api.js';

const mockFetch = vi.fn();

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

const START = new Date('2026-08-01T00:00:00.000Z');
const END = new Date('2026-08-09T00:00:00.000Z');

describe('fetchActualCost', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns not-configured when the admin key is absent', async () => {
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', '');

    const result = await fetchActualCost(START, END);

    // 未設定を $0 に潰さないこと。潰すと「コストが常に0円」の再来になる。
    expect(result).toEqual({ kind: 'not-configured' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('converts the cents-denominated amount string to USD', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            starting_at: '2026-08-08T00:00:00Z',
            ending_at: '2026-08-09T00:00:00Z',
            // amount は「最小通貨単位(セント)の10進文字列」。123.45 = $1.2345
            results: [{ amount: '123.45', currency: 'USD' }],
          },
        ],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);

    expect(result).toEqual({
      kind: 'ok',
      totalCostUsd: 1.2345,
      daily: [{ date: '2026-08-08', costUsd: 1.2345 }],
      // group_by が無い応答（model も cost_type も無い）は受け皿に積む。
      // 落とすと内訳の合計が総額と合わなくなる。
      byModel: [
        {
          model: '(内訳なし)',
          costUsd: 1.2345,
          byTokenType: [{ tokenType: '(その他)', costUsd: 1.2345 }],
        },
      ],
      truncated: false,
    });
  });

  it('sums multiple cost items within one bucket', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            starting_at: '2026-08-08T00:00:00Z',
            results: [{ amount: '100' }, { amount: '50.5' }],
          },
        ],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.totalCostUsd).toBeCloseTo(1.505, 6);
  });

  it('follows pagination until has_more is false', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ starting_at: '2026-08-07T00:00:00Z', results: [{ amount: '100' }] }],
          has_more: true,
          next_page: 'page_2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ starting_at: '2026-08-08T00:00:00Z', results: [{ amount: '200' }] }],
          has_more: false,
        }),
      );

    const result = await fetchActualCost(START, END);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('page=page_2');
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.totalCostUsd).toBeCloseTo(3, 6);
    expect(result.daily).toHaveLength(2);
  });

  it('flags truncation when paging hits the page cap', async () => {
    // 上限 (MAX_PAGES=10) に達しても has_more が true のままなら、実額は途中までしか
    // 積まれていない。これを黙って完全な実額として返すと過少計上になる。
    for (let i = 0; i < 12; i++) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: [
            { starting_at: `2026-08-0${(i % 9) + 1}T00:00:00Z`, results: [{ amount: '100' }] },
          ],
          has_more: true,
          next_page: `page_${i + 1}`,
        }),
      );
    }

    const result = await fetchActualCost(START, END);

    expect(mockFetch).toHaveBeenCalledTimes(10);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.truncated).toBe(true);
  });

  it('does not flag truncation when the last page fits exactly at the cap', async () => {
    // ちょうど10ページ目で has_more:false なら打ち切りではない（境界の off-by-one 防止）。
    for (let i = 0; i < 9; i++) {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: [{ starting_at: `2026-08-0${i + 1}T00:00:00Z`, results: [{ amount: '100' }] }],
          has_more: true,
          next_page: `page_${i + 1}`,
        }),
      );
    }
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [{ starting_at: '2026-08-10T00:00:00Z', results: [{ amount: '100' }] }],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);

    expect(mockFetch).toHaveBeenCalledTimes(10);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.truncated).toBe(false);
  });

  it('sends the admin key on the x-api-key header', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], has_more: false }));

    await fetchActualCost(START, END);

    const init = mockFetch.mock.calls[0][1];
    expect(init.headers['x-api-key']).toBe('sk-ant-admin01-test');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(mockFetch.mock.calls[0][0]).toContain('bucket_width=1d');
  });

  it('returns an error result on a non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'nope' }, false, 401));

    const result = await fetchActualCost(START, END);

    expect(result.kind).toBe('error');
    if (result.kind !== 'error') return;
    expect(result.message).toContain('401');
  });

  it('returns an error result when the request throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    const result = await fetchActualCost(START, END);

    expect(result).toEqual({ kind: 'error', message: 'timeout' });
  });

  it('returns an error result on an unexpected payload shape', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ unexpected: true }));

    const result = await fetchActualCost(START, END);

    expect(result.kind).toBe('error');
  });

  it('reports zero (not an error) when the org genuinely spent nothing', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], has_more: false }));

    const result = await fetchActualCost(START, END);

    expect(result).toEqual({
      kind: 'ok',
      totalCostUsd: 0,
      daily: [],
      byModel: [],
      truncated: false,
    });
  });
});

describe('formatActualCost', () => {
  it.each<[ActualCostResult, string]>([
    [{ kind: 'ok', totalCostUsd: 1.2345, daily: [], byModel: [], truncated: false }, '$1.2345'],
    [
      { kind: 'ok', totalCostUsd: 1.2345, daily: [], byModel: [], truncated: true },
      '$1.2345 (集計打ち切り・過少)',
    ],
    [{ kind: 'not-configured' }, '未設定 (ANTHROPIC_ADMIN_KEY)'],
    [{ kind: 'error', message: 'boom' }, '取得失敗: boom'],
  ])('formats %j', (input, expected) => {
    expect(formatActualCost(input)).toBe(expected);
  });
});

describe('fetchActualCost のページング効率', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // limit を渡さないと既定 7 バケットになり、30 日を取るのに外部 API へ 5 往復する。
  // これがコスト画面の待ち時間の主因だった。上限の 31 を明示していることを固定する。
  it('1ページで上限（31バケット）を要求する', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], has_more: false, next_page: null }));

    await fetchActualCost(START, END);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.get('limit')).toBe('31');
    expect(url.searchParams.get('bucket_width')).toBe('1d');
  });

  // 31 を超える範囲では従来どおりページングする（1ページ目で打ち切らない）。
  it('has_more が続く限りページを進める', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ starting_at: '2026-08-01T00:00:00Z', results: [{ amount: '100' }] }],
          has_more: true,
          next_page: 'page_2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ starting_at: '2026-09-01T00:00:00Z', results: [{ amount: '250' }] }],
          has_more: false,
          next_page: null,
        }),
      );

    const result = await fetchActualCost(START, END);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(new URL(mockFetch.mock.calls[1][0]).searchParams.get('page')).toBe('page_2');
    // amount はセント単位の10進文字列。100 + 250 セント = $3.50。
    expect(result).toMatchObject({ kind: 'ok', totalCostUsd: 3.5, truncated: false });
  });
});

// 用途別の内訳を **実額** で出すための中核。ここが効いていないと、
// 「OCR がいくらか」を自前トークンの推定でしか出せなくなる。
describe('モデル別の実額内訳', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // 配列パラメータは group_by[]。group_by= だと無視され、results が1件に丸められて
  // model が null になる（= 内訳が黙って出なくなる）。
  it('group_by[]=description を送る', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], has_more: false, next_page: null }));

    await fetchActualCost(START, END);

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.getAll('group_by[]')).toEqual(['description']);
  });

  it('モデル別に積み上げ、コスト降順で返す', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            starting_at: '2026-08-08T00:00:00Z',
            results: [
              // 発酵のモデル
              {
                amount: '1.7916',
                model: 'claude-sonnet-4-6',
                token_type: 'uncached_input_tokens',
                cost_type: 'tokens',
              },
              {
                amount: '10.692',
                model: 'claude-sonnet-4-6',
                token_type: 'output_tokens',
                cost_type: 'tokens',
              },
              // OCR のモデル
              {
                amount: '20.0',
                model: 'claude-opus-5',
                token_type: 'uncached_input_tokens',
                cost_type: 'tokens',
              },
            ],
          },
        ],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);
    if (result.kind !== 'ok') throw new Error('expected ok');

    expect(result.byModel.map((m) => m.model)).toEqual(['claude-opus-5', 'claude-sonnet-4-6']);
    expect(result.byModel[0]?.costUsd).toBeCloseTo(0.2, 10);
    // 1.7916 + 10.692 セント = $0.124836（自前推定と同じ額を実額側から得られる）
    expect(result.byModel[1]?.costUsd).toBeCloseTo(0.124836, 10);
  });

  it('token_type ごとの内訳も返す（キャッシュが混ざれば見える）', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            starting_at: '2026-08-08T00:00:00Z',
            results: [
              { amount: '100', model: 'claude-opus-5', token_type: 'uncached_input_tokens' },
              { amount: '300', model: 'claude-opus-5', token_type: 'output_tokens' },
              { amount: '10', model: 'claude-opus-5', token_type: 'cache_read_input_tokens' },
            ],
          },
        ],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);
    if (result.kind !== 'ok') throw new Error('expected ok');

    expect(result.byModel[0]?.byTokenType.map((t) => t.tokenType)).toEqual([
      'output_tokens',
      'uncached_input_tokens',
      'cache_read_input_tokens',
    ]);
  });

  it('複数バケット・複数ページをまたいで同じモデルをまとめる', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              starting_at: '2026-08-08T00:00:00Z',
              results: [{ amount: '100', model: 'claude-opus-5', token_type: 'output_tokens' }],
            },
            {
              starting_at: '2026-08-09T00:00:00Z',
              results: [{ amount: '200', model: 'claude-opus-5', token_type: 'output_tokens' }],
            },
          ],
          has_more: true,
          next_page: 'page_2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              starting_at: '2026-08-10T00:00:00Z',
              results: [{ amount: '400', model: 'claude-opus-5', token_type: 'output_tokens' }],
            },
          ],
          has_more: false,
          next_page: null,
        }),
      );

    const result = await fetchActualCost(START, END);
    if (result.kind !== 'ok') throw new Error('expected ok');

    expect(result.byModel).toHaveLength(1);
    expect(result.byModel[0]?.costUsd).toBeCloseTo(7, 10);
  });

  // トークン以外のコスト（web_search 等）は model が null。落とすと内訳が総額に合わなくなる。
  it('model が無いコストも cost_type で括って残す', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            starting_at: '2026-08-08T00:00:00Z',
            results: [
              { amount: '100', model: 'claude-opus-5', token_type: 'output_tokens' },
              { amount: '50', model: null, cost_type: 'web_search', token_type: null },
            ],
          },
        ],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);
    if (result.kind !== 'ok') throw new Error('expected ok');

    expect(result.byModel.map((m) => m.model)).toContain('(web_search)');
  });

  // これが崩れると「内訳を全部出した」ように見えて実際は欠けている状態になる。
  it('内訳の合計は必ず総額と一致する', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            starting_at: '2026-08-08T00:00:00Z',
            results: [
              { amount: '1.7916', model: 'claude-sonnet-4-6', token_type: 'uncached_input_tokens' },
              { amount: '10.692', model: 'claude-sonnet-4-6', token_type: 'output_tokens' },
              { amount: '20', model: 'claude-opus-5', token_type: 'output_tokens' },
              { amount: '5', model: null, cost_type: 'web_search' },
              { amount: '3', model: null },
            ],
          },
        ],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);
    if (result.kind !== 'ok') throw new Error('expected ok');

    const sum = result.byModel.reduce((acc, m) => acc + m.costUsd, 0);
    expect(sum).toBeCloseTo(result.totalCostUsd, 10);

    // token_type の内訳も、そのモデルの合計と一致する
    for (const model of result.byModel) {
      const tokenSum = model.byTokenType.reduce((acc, t) => acc + t.costUsd, 0);
      expect(tokenSum).toBeCloseTo(model.costUsd, 10);
    }
  });
});
