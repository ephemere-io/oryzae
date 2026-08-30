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

    expect(result).toEqual({ kind: 'ok', totalCostUsd: 0, daily: [], truncated: false });
  });
});

describe('formatActualCost', () => {
  it.each<[ActualCostResult, string]>([
    [{ kind: 'ok', totalCostUsd: 1.2345, daily: [], truncated: false }, '$1.2345'],
    [
      { kind: 'ok', totalCostUsd: 1.2345, daily: [], truncated: true },
      '$1.2345 (集計打ち切り・過少)',
    ],
    [{ kind: 'not-configured' }, '未設定 (ANTHROPIC_ADMIN_KEY)'],
    [{ kind: 'error', message: 'boom' }, '取得失敗: boom'],
  ])('formats %j', (input, expected) => {
    expect(formatActualCost(input)).toBe(expected);
  });
});
