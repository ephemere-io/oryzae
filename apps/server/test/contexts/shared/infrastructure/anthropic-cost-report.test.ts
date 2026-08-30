import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type DailyCost,
  fetchDailyCosts,
  sumDailyCosts,
} from '@/contexts/shared/infrastructure/anthropic-cost-report';

function okResponse(body: unknown): Response {
  // @type-assertion-allowed: テストで必要な最小限の Response スタブ
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

function errorResponse(status: number): Response {
  // @type-assertion-allowed: テストで必要な最小限の Response スタブ
  return { ok: false, status, json: () => Promise.resolve({}) } as Response;
}

const BUCKET = {
  starting_at: '2026-08-01T00:00:00Z',
  ending_at: '2026-08-02T00:00:00Z',
  results: [
    // amount は「最小通貨単位」= セント建ての文字列（anthropic-cost-report.ts の
    // toUsd に出典あり）。123.45 セント = $1.2345、76.55 セント = $0.7655。
    { amount: '123.45', currency: 'USD', model: 'claude-sonnet-5' },
    { amount: '76.55', currency: 'USD', model: 'claude-sonnet-4-6' },
  ],
};

describe('fetchDailyCosts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.ANTHROPIC_ADMIN_KEY = 'sk-ant-admin-test';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.ANTHROPIC_ADMIN_KEY = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Admin キーが無ければ null（呼び出し側が概算にフォールバックする）', async () => {
    process.env.ANTHROPIC_ADMIN_KEY = '';

    expect(await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('セント建ての amount をドルに直して日次で合算する', async () => {
    fetchMock.mockResolvedValue(okResponse({ data: [BUCKET], has_more: false, next_page: null }));

    const costs = await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z');

    // (123.45 + 76.55) セント = 200 セント = $2.00
    expect(costs).toEqual<DailyCost[]>([{ date: '2026-08-01', amountUsd: 2 }]);
  });

  it('Admin キーを x-api-key に載せ、日次バケットで問い合わせる', async () => {
    fetchMock.mockResolvedValue(okResponse({ data: [], has_more: false, next_page: null }));

    await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/organizations/cost_report');
    expect(new URL(String(url)).searchParams.get('bucket_width')).toBe('1d');
    expect(init.headers['x-api-key']).toBe('sk-ant-admin-test');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
  });

  // has_more を見ずに next_page だけで判定すると、下の 2 ケースで止まらなくなる。
  it('has_more が false なら next_page が残っていても止まる', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ data: [BUCKET], has_more: false, next_page: 'page_2' }),
    );

    const costs = await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(costs).toHaveLength(1);
  });

  it('同じカーソルを返し続けても止まる（無限ループにしない）', async () => {
    fetchMock.mockResolvedValue(okResponse({ data: [BUCKET], has_more: true, next_page: 'same' }));

    const costs = await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z');

    // 1 回目で same を記録し、2 回目で「進んでいない」と判断して抜ける。
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(costs).toHaveLength(2);
  });

  it('next_page を辿って全期間を集める', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ data: [BUCKET], has_more: true, next_page: 'page_2' }))
      .mockResolvedValueOnce(
        okResponse({
          data: [{ ...BUCKET, starting_at: '2026-09-01T00:00:00Z' }],
          has_more: false,
          next_page: null,
        }),
      );

    const costs = await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-09-02T00:00:00Z');

    expect(costs).toHaveLength(2);
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('page')).toBe('page_2');
  });

  it('API がエラーを返したら null（概算にフォールバックさせる）', async () => {
    fetchMock.mockResolvedValue(errorResponse(401));

    expect(await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z')).toBeNull();
  });

  it('通信が落ちても投げずに null', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    expect(await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z')).toBeNull();
  });

  it('壊れた形のレスポンスでも落ちない', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ data: [{ starting_at: '2026-08-01T00:00:00Z', results: 'nope' }, null, 42] }),
    );

    expect(await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z')).toEqual([
      { date: '2026-08-01', amountUsd: 0 },
    ]);
  });

  it('使用の無い日は 0 円のバケットとして返る', async () => {
    fetchMock.mockResolvedValue(
      okResponse({
        data: [{ starting_at: '2026-08-01T00:00:00Z', results: [] }],
        has_more: false,
      }),
    );

    expect(await fetchDailyCosts('2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z')).toEqual([
      { date: '2026-08-01', amountUsd: 0 },
    ]);
  });
});

describe('sumDailyCosts', () => {
  it('日次コストを合計する', () => {
    expect(sumDailyCosts([{ date: '2026-08-01', amountUsd: 1.5 }])).toBeCloseTo(1.5, 10);
    expect(
      sumDailyCosts([
        { date: '2026-08-01', amountUsd: 1.5 },
        { date: '2026-08-02', amountUsd: 2.25 },
      ]),
    ).toBeCloseTo(3.75, 10);
  });

  it('空なら 0', () => {
    expect(sumDailyCosts([])).toBe(0);
  });
});
