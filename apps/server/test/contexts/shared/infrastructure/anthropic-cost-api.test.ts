import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ActualCostResult,
  fetchActualCost,
  fetchUsageDetail,
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
      groupingUnavailable: true,
      byModel: [
        {
          model: '(内訳なし)',
          costUsd: 1.2345,
          byTokenType: [{ tokenType: '(その他)', costUsd: 1.2345 }],
        },
      ],
      // workspace_id が無い result は default workspace（Anthropic の仕様）。
      byWorkspace: [
        {
          workspaceId: null,
          workspaceName: 'Default Workspace',
          costUsd: 1.2345,
          byModel: [{ model: '(内訳なし)', costUsd: 1.2345 }],
        },
      ],
      workspaceNamesUnavailable: false,
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
      byWorkspace: [],
      groupingUnavailable: false,
      workspaceNamesUnavailable: false,
      truncated: false,
    });
  });
});

describe('formatActualCost', () => {
  it.each<[ActualCostResult, string]>([
    [
      {
        kind: 'ok',
        totalCostUsd: 1.2345,
        daily: [],
        byModel: [],
        byWorkspace: [],
        groupingUnavailable: false,
        workspaceNamesUnavailable: false,
        truncated: false,
      },
      '$1.2345',
    ],
    [
      {
        kind: 'ok',
        totalCostUsd: 1.2345,
        daily: [],
        byModel: [],
        byWorkspace: [],
        groupingUnavailable: false,
        workspaceNamesUnavailable: false,
        truncated: true,
      },
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
  // workspace_id が **用途別**、description が各 Workspace 内の **モデル別**。
  // どちらか片方に戻すと、用途別の実額かモデルの内訳のどちらかが黙って消える。
  it('group_by[] に workspace_id と description を両方送る', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ data: [], has_more: false, next_page: null }));

    await fetchActualCost(START, END);

    const url = new URL(mockFetch.mock.calls[0][0]);
    expect(url.searchParams.getAll('group_by[]')).toEqual(['workspace_id', 'description']);
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

  // group_by が効かなくなると「総額は正しいのに内訳だけ静かに消える」。
  // 実 API で書式を確かめられない以上、実行時に気づける形にしておく。
  it('内訳が返らなければ groupingUnavailable を立てる', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [{ starting_at: '2026-08-08T00:00:00Z', results: [{ amount: '500' }] }],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);
    if (result.kind !== 'ok') throw new Error('expected ok');

    expect(result.groupingUnavailable).toBe(true);
    // 総額そのものは正しい（内訳だけが取れていない）
    expect(result.totalCostUsd).toBeCloseTo(5, 10);
  });

  it('内訳が1件でも返っていれば立てない', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            starting_at: '2026-08-08T00:00:00Z',
            results: [
              { amount: '500', model: 'claude-opus-5', token_type: 'output_tokens' },
              { amount: '10' },
            ],
          },
        ],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);
    if (result.kind !== 'ok') throw new Error('expected ok');

    expect(result.groupingUnavailable).toBe(false);
  });

  it('課金ゼロの期間では立てない（内訳が無くて当然）', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [{ starting_at: '2026-08-08T00:00:00Z', results: [] }],
        has_more: false,
      }),
    );

    const result = await fetchActualCost(START, END);
    if (result.kind !== 'ok') throw new Error('expected ok');

    expect(result.groupingUnavailable).toBe(false);
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

/** URL ごとに応答を返し分ける（3 つの取得が並行に飛ぶので順序に頼れない）。 */
function routeFetch(routes: Record<string, unknown[]>) {
  const calls: Record<string, number> = {};
  mockFetch.mockImplementation((url: string) => {
    const key = Object.keys(routes).find((path) => url.includes(path));
    if (!key) return Promise.resolve(jsonResponse({}, false, 404));
    const n = calls[key] ?? 0;
    calls[key] = n + 1;
    const pages = routes[key] ?? [];
    return Promise.resolve(jsonResponse(pages[Math.min(n, pages.length - 1)]));
  });
}

describe('fetchUsageDetail', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('Admin キーが無ければ not-configured', async () => {
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', '');

    expect(await fetchUsageDetail(START, END)).toEqual({ kind: 'not-configured' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // 一覧系は after_id / last_id でページを送る。以前は page / next_page で送っていて、
  // 2 ページ目があっても 1 ページ目を読み続けていた。
  it('Workspace 一覧は after_id でページを送り、アーカイブ済みを除く', async () => {
    routeFetch({
      '/workspaces': [
        {
          data: [{ id: 'wrkspc_a', name: 'oryzae-prod-ocr', archived_at: null }],
          has_more: true,
          last_id: 'wrkspc_a',
        },
        {
          data: [
            { id: 'wrkspc_b', name: 'oryzae-ci', archived_at: null },
            { id: 'wrkspc_old', name: 'old', archived_at: '2026-09-01T00:00:00Z' },
          ],
          has_more: false,
          last_id: 'wrkspc_old',
        },
      ],
      '/api_keys': [{ data: [], has_more: false }],
      '/usage_report/messages': [{ data: [], has_more: false }],
    });

    const result = await fetchUsageDetail(START, END);

    expect(result.kind === 'ok' && result.workspaces).toEqual([
      { id: 'wrkspc_a', name: 'oryzae-prod-ocr' },
      { id: 'wrkspc_b', name: 'oryzae-ci' },
    ]);
    const secondPage = mockFetch.mock.calls
      .map(([url]) => new URL(String(url)))
      .filter((u) => u.pathname.endsWith('/workspaces'))[1];
    expect(secondPage?.searchParams.get('after_id')).toBe('wrkspc_a');
  });

  // scope.workspace_id は default workspace でも実 ID を返す。cost_report / usage_report は
  // default を null で返すので、揃えないと Default Workspace のキーが行き場を失う。
  it('default workspace のキーは所属を null にする（cost_report と同じ表現）', async () => {
    routeFetch({
      '/workspaces': [{ data: [], has_more: false }],
      '/api_keys': [
        {
          data: [
            {
              id: 'apikey_student',
              name: 'waseda-class',
              status: 'active',
              workspace_id: null,
              scope: { type: 'workspace', workspace_id: 'wrkspc_default_real' },
            },
            {
              id: 'apikey_ocr',
              name: 'oryzae-prod-ocr-board',
              status: 'active',
              workspace_id: 'wrkspc_a',
              scope: { type: 'workspace', workspace_id: 'wrkspc_a' },
            },
          ],
          has_more: false,
        },
      ],
      '/usage_report/messages': [{ data: [], has_more: false }],
    });

    const result = await fetchUsageDetail(START, END);

    expect(result.kind === 'ok' && result.apiKeys).toEqual([
      { id: 'apikey_student', name: 'waseda-class', status: 'active', workspaceId: null },
      {
        id: 'apikey_ocr',
        name: 'oryzae-prod-ocr-board',
        status: 'active',
        workspaceId: 'wrkspc_a',
      },
    ]);
  });

  it('キー別のトークン数を期間で合算し、キャッシュの書込・読込を分けて持つ', async () => {
    routeFetch({
      '/workspaces': [{ data: [], has_more: false }],
      '/api_keys': [{ data: [], has_more: false }],
      '/usage_report/messages': [
        {
          data: [
            {
              starting_at: '2026-08-01T00:00:00Z',
              results: [
                {
                  api_key_id: 'apikey_ocr',
                  workspace_id: 'wrkspc_a',
                  uncached_input_tokens: 1000,
                  cache_creation: { ephemeral_1h_input_tokens: 5, ephemeral_5m_input_tokens: 10 },
                  cache_read_input_tokens: 20,
                  output_tokens: 50,
                },
              ],
            },
            {
              starting_at: '2026-08-02T00:00:00Z',
              results: [
                {
                  api_key_id: 'apikey_ocr',
                  workspace_id: 'wrkspc_a',
                  uncached_input_tokens: 500,
                  cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 },
                  cache_read_input_tokens: 0,
                  output_tokens: 25,
                },
              ],
            },
          ],
          has_more: false,
        },
      ],
    });

    const result = await fetchUsageDetail(START, END);

    expect(result.kind === 'ok' && result.usageByKey).toEqual([
      {
        apiKeyId: 'apikey_ocr',
        workspaceId: 'wrkspc_a',
        uncachedInputTokens: 1500,
        cacheCreationInputTokens: 15,
        cacheReadInputTokens: 20,
        outputTokens: 75,
      },
    ]);
    const usageUrl = mockFetch.mock.calls
      .map(([url]) => new URL(String(url)))
      .find((u) => u.pathname.endsWith('/usage_report/messages'));
    expect(usageUrl?.searchParams.getAll('group_by[]')).toEqual(['api_key_id', 'workspace_id']);
  });

  // 名前やトークン数は補助情報。どれかが取れなくても金額のレポートは止めない。
  it('一部の取得に失敗しても、その部分だけ null にして返す', async () => {
    routeFetch({
      '/workspaces': [{ data: [{ id: 'wrkspc_a', name: 'oryzae-prod-ocr' }], has_more: false }],
      '/usage_report/messages': [{ data: [], has_more: false }],
      // api_keys は 404
    });

    const result = await fetchUsageDetail(START, END);

    expect(result).toEqual({
      kind: 'ok',
      workspaces: [{ id: 'wrkspc_a', name: 'oryzae-prod-ocr' }],
      apiKeys: null,
      usageByKey: [],
    });
  });
});
