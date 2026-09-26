import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchActualCost = vi.fn();
const mockListWorkspaces = vi.fn();
const mockFetchAiUsage = vi.fn();

vi.mock('@/contexts/shared/infrastructure/anthropic-cost-api.js', () => ({
  ANTHROPIC_COST_CONSOLE_URL: 'https://platform.claude.com/cost',
  DEFAULT_WORKSPACE_LABEL: 'Default Workspace',
  fetchActualCost: (...args: unknown[]) => mockFetchActualCost(...args),
  listWorkspaces: (...args: unknown[]) => mockListWorkspaces(...args),
}));
vi.mock('@/contexts/shared/infrastructure/ai-usage-query.js', () => ({
  fetchAiUsage: (...args: unknown[]) => mockFetchAiUsage(...args),
}));
vi.mock('@/contexts/shared/infrastructure/user-labels.js', () => ({
  resolveUserLabels: async (_: unknown, ids: string[]) =>
    new Map(ids.filter((id) => id === 'u1').map((id) => [id, 'kunimo (k@example.com)'])),
}));

const { adminCosts } = await import('@/contexts/shared/presentation/routes/admin-costs.js');

function createApp() {
  return new Hono()
    .use('*', async (c, next) => {
      // @type-assertion-allowed: テスト用の空の Supabase。この経路の DB 呼び出しは全て vi.mock で差し替えている
      c.set('adminSupabase' as never, {} as never);
      await next();
    })
    .route('/costs', adminCosts);
}

const emptyFeature = { count: 0, inputTokens: 0, outputTokens: 0, byUser: [] };

function usage(over: Record<string, unknown> = {}) {
  return {
    kind: 'ok',
    truncated: false,
    byFeature: {
      fermentation: {
        count: 2,
        inputTokens: 1_000_000,
        outputTokens: 0,
        byUser: [{ userId: 'u1', count: 2, inputTokens: 1_000_000, outputTokens: 0 }],
      },
      ocr_board: {
        count: 1,
        inputTokens: 1_000_000,
        outputTokens: 0,
        byUser: [{ userId: 'u2abcdef-9999', count: 1, inputTokens: 1_000_000, outputTokens: 0 }],
      },
      ocr_entry: emptyFeature,
      ...over,
    },
  };
}

function actualOk(total: number) {
  return {
    kind: 'ok',
    totalCostUsd: total,
    daily: [{ date: '2026-09-25', costUsd: total }],
    byModel: [],
    byWorkspace: [
      {
        workspaceId: 'ws_f',
        workspaceName: 'oryzae-prod-fermentation',
        costUsd: total,
        byModel: [],
      },
    ],
    workspaceNamesUnavailable: false,
    groupingUnavailable: false,
    truncated: false,
  };
}

describe('GET /admin/costs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T12:00:00.000Z'));
    mockFetchActualCost.mockResolvedValue(actualOk(25));
    mockListWorkspaces.mockResolvedValue([
      { id: 'ws_f', name: 'oryzae-prod-fermentation' },
      { id: 'ws_o', name: 'oryzae-prod-ocr' },
    ]);
    mockFetchAiUsage.mockResolvedValue(usage());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('期間を省略すると今月（UTC 月初〜今）を JST の時刻範囲で返す', async () => {
    const res = await createApp().request('/costs');
    const body = await res.json();

    expect(body.period).toEqual({
      from: '2026-09-01',
      to: '2026-09-26',
      label: '9/1 9:00 〜 9/26 21:00 (JST)',
    });
    // 未来は読まない
    const [start, end] = mockFetchActualCost.mock.calls[0] ?? [];
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-26T12:00:00.000Z');
  });

  it('$0 の Workspace も並べ、Default Workspace は Oryzae 外として最後に置く', async () => {
    const body = await (await createApp().request('/costs')).json();

    expect(body.actual.byWorkspace).toEqual([
      { name: 'oryzae-prod-fermentation', costUsd: 25, outsideOryzae: false },
      { name: 'oryzae-prod-ocr', costUsd: 0, outsideOryzae: false },
      { name: 'Default Workspace', costUsd: 0, outsideOryzae: true },
    ]);
  });

  it('今月を見ているときだけ、閉じた日数の平均で月末の見込みを出す', async () => {
    const body = await (await createApp().request('/costs')).json();
    // 9/1〜9/25 の 25 日で $25 → 30 日で $30
    expect(body.actual.projection).toEqual({ projectedUsd: 30, daysElapsed: 25, daysInMonth: 30 });

    const last = await (await createApp().request('/costs?from=2026-08-01&to=2026-08-31')).json();
    expect(last.actual.projection).toBeNull();
  });

  it('機能ごとに、その機能のモデルの単価で推定額を出す', async () => {
    const body = await (await createApp().request('/costs')).json();
    const byFeature = Object.fromEntries(
      body.usage.features.map((f: { feature: string; estimatedUsd: number; model: string }) => [
        f.feature,
        [f.model, f.estimatedUsd],
      ]),
    );

    // 入力 100 万トークン: 発酵（sonnet-4-6）$3、OCR（sonnet-5）$2
    expect(byFeature).toEqual({
      fermentation: ['claude-sonnet-4-6', 3],
      ocr_board: ['claude-sonnet-5', 2],
      ocr_entry: ['claude-sonnet-5', 0],
    });
  });

  it('ユーザー別は機能をまたいでまとめ、推定額の多い順。名前が無ければ ID の先頭 8 桁', async () => {
    mockFetchAiUsage.mockResolvedValue(
      usage({
        ocr_entry: {
          count: 1,
          inputTokens: 1_000_000,
          outputTokens: 0,
          byUser: [{ userId: 'u1', count: 1, inputTokens: 1_000_000, outputTokens: 0 }],
        },
      }),
    );
    const body = await (await createApp().request('/costs')).json();

    expect(
      body.usage.users.map((u: { label: string; counts: unknown; estimatedUsd: number }) => [
        u.label,
        u.counts,
        u.estimatedUsd,
      ]),
    ).toEqual([
      ['kunimo (k@example.com)', { fermentation: 2, ocr_board: 0, ocr_entry: 1 }, 5],
      ['u2abcdef', { fermentation: 0, ocr_board: 1, ocr_entry: 0 }, 2],
    ]);
  });

  it('実額が取れなくても 0 と書かず、記録の側は出す', async () => {
    mockFetchActualCost.mockResolvedValue({ kind: 'not-configured' });
    mockListWorkspaces.mockResolvedValue('not-configured');
    const body = await (await createApp().request('/costs')).json();

    expect(body.actual).toEqual({ status: 'not-configured' });
    expect(body.usage.status).toBe('ok');
  });

  it('記録を読めなかったときは 0 回ではなくエラーとして返す', async () => {
    mockFetchAiUsage.mockResolvedValue({ kind: 'error', message: 'relation does not exist' });
    const body = await (await createApp().request('/costs')).json();

    expect(body.usage).toEqual({ status: 'error', message: 'relation does not exist' });
  });

  it('日付の形が違う・前後が逆・長すぎる期間は 400', async () => {
    const app = createApp();
    expect((await app.request('/costs?from=2026/09/01')).status).toBe(400);
    expect((await app.request('/costs?from=2026-09-10&to=2026-09-01')).status).toBe(400);
    expect((await app.request('/costs?from=2024-01-01&to=2026-09-01')).status).toBe(400);
  });
});
