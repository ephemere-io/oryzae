import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAnalytics } from '@/contexts/analytics/presentation/routes/admin-analytics.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function createApp() {
  return new Hono().route('/analytics', adminAnalytics);
}

function mockPostHogResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

describe('admin-analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_test_key');
  });

  it('GET /overview returns analytics overview', async () => {
    const trendResponse = {
      result: [
        {
          data: [10, 20, 30],
          days: ['2026-04-10', '2026-04-11', '2026-04-12'],
          label: '$pageview',
        },
      ],
    };
    const sessionResponse = {
      results: [[42, 180]],
    };

    // 4 parallel calls: total PV, entry PV, jar PV, session query
    mockFetch
      .mockResolvedValueOnce(mockPostHogResponse(trendResponse))
      .mockResolvedValueOnce(
        mockPostHogResponse({ result: [{ data: [5, 10, 15], days: [], label: '' }] }),
      )
      .mockResolvedValueOnce(
        mockPostHogResponse({ result: [{ data: [2, 3, 4], days: [], label: '' }] }),
      )
      .mockResolvedValueOnce(mockPostHogResponse(sessionResponse));

    const app = createApp();
    const res = await app.request('/analytics/overview');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalPageviews).toBe(60);
    expect(body.entryPageViews).toBe(30);
    expect(body.jarPageViews).toBe(9);
    expect(body.totalSessions).toBe(42);
    expect(body.avgSessionDurationSeconds).toBe(180);
  });

  it('GET /pages returns page breakdown', async () => {
    mockFetch.mockResolvedValueOnce(
      mockPostHogResponse({
        result: [
          { data: [30], days: ['2026-04-12'], label: '/entries' },
          { data: [10], days: ['2026-04-12'], label: '/jar' },
        ],
      }),
    );

    const app = createApp();
    const res = await app.request('/analytics/pages');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].path).toBe('/entries');
    expect(body.data[0].views).toBe(30);
  });

  it('GET /daily returns daily time series', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockPostHogResponse({
          result: [{ data: [10, 20], days: ['2026-04-11', '2026-04-12'], label: '$pageview' }],
        }),
      )
      .mockResolvedValueOnce(
        mockPostHogResponse({
          result: [{ data: [5, 8], days: ['2026-04-11', '2026-04-12'], label: '$pageview' }],
        }),
      );

    const app = createApp();
    const res = await app.request('/analytics/daily');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].pageviews).toBe(10);
    expect(body.data[0].uniqueUsers).toBe(5);
  });

  it('returns zeros when PostHog API key is not set', async () => {
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '');

    const app = createApp();
    const res = await app.request('/analytics/overview');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalPageviews).toBe(0);
    expect(body.totalSessions).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
