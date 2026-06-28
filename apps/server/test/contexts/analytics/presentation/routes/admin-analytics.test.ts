import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAnalytics } from '@/contexts/analytics/presentation/routes/admin-analytics.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createApp() {
  return new Hono().route('/analytics', adminAnalytics);
}

// HogQL Query API (/query/) は { results: unknown[][] } を返す。
function hogqlOk(results: unknown[][]): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ results }),
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

function hogqlFail(status: number): Response {
  return {
    ok: false,
    status,
    text: () => Promise.resolve('error detail'),
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('admin-analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_test_key');
  });

  it('GET /overview aggregates pageviews and sessions via HogQL', async () => {
    mockFetch
      .mockResolvedValueOnce(hogqlOk([[60, 30, 9]])) // total_pv / entry_pv / jar_pv
      .mockResolvedValueOnce(hogqlOk([[42, 180]])); // sessions / avg_duration

    const res = await createApp().request('/analytics/overview');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalPageviews).toBe(60);
    expect(body.entryPageViews).toBe(30);
    expect(body.jarPageViews).toBe(9);
    expect(body.totalSessions).toBe(42);
    expect(body.avgSessionDurationSeconds).toBe(180);
  });

  it('GET /pages returns sorted page breakdown', async () => {
    mockFetch.mockResolvedValueOnce(
      hogqlOk([
        ['/entries', 30],
        ['/jar', 10],
      ]),
    );

    const res = await createApp().request('/analytics/pages');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toEqual({ path: '/entries', views: 30 });
  });

  it('GET /daily returns daily series for the selected range', async () => {
    mockFetch.mockResolvedValueOnce(
      hogqlOk([
        ['2026-04-11', 10, 5],
        ['2026-04-12', 20, 8],
      ]),
    );

    const res = await createApp().request(
      '/analytics/daily?date_from=2026-04-11&date_to=2026-04-12',
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([
      { date: '2026-04-11', pageviews: 10, uniqueUsers: 5 },
      { date: '2026-04-12', pageviews: 20, uniqueUsers: 8 },
    ]);
  });

  it('GET /daily fills days without events as zero', async () => {
    mockFetch.mockResolvedValueOnce(hogqlOk([['2026-04-12', 20, 8]]));

    const res = await createApp().request(
      '/analytics/daily?date_from=2026-04-11&date_to=2026-04-12',
    );

    const body = await res.json();
    expect(body.data).toEqual([
      { date: '2026-04-11', pageviews: 0, uniqueUsers: 0 },
      { date: '2026-04-12', pageviews: 20, uniqueUsers: 8 },
    ]);
  });

  it('returns 503 when PostHog API key is not set (no silent zeros)', async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '');

    const res = await createApp().request('/analytics/overview');

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain('未設定');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 502 when PostHog responds with an error (e.g. legacy endpoint 403)', async () => {
    mockFetch.mockResolvedValue(hogqlFail(403));

    const res = await createApp().request('/analytics/overview');

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('403');
  });
});
