import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

interface PostHogTrendResult {
  data: number[];
  days: string[];
  label: string;
}

interface PostHogTrendResponse {
  result: PostHogTrendResult[];
}

interface PostHogQueryResponse {
  results: unknown[][];
}

function isPostHogTrendResponse(data: unknown): data is PostHogTrendResponse {
  if (typeof data !== 'object' || data === null) return false;
  return 'result' in data && Array.isArray((data as PostHogTrendResponse).result);
}

function isPostHogQueryResponse(data: unknown): data is PostHogQueryResponse {
  if (typeof data !== 'object' || data === null) return false;
  return 'results' in data && Array.isArray((data as PostHogQueryResponse).results);
}

const POSTHOG_PROJECT_ID = '378500';
const POSTHOG_HOST = 'https://us.i.posthog.com';

async function posthogFetch<T>(
  path: string,
  body: unknown,
  guard: (data: unknown) => data is T,
): Promise<T | null> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (!guard(data)) return null;
  return data;
}

export const adminAnalytics = new Hono<Env>()
  .get('/overview', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';

    const [pvRes, entryPvRes, jarPvRes, sessionRes] = await Promise.all([
      posthogFetch(
        '/insights/trend/',
        {
          events: [{ id: '$pageview', math: 'total' }],
          date_from: dateFrom,
        },
        isPostHogTrendResponse,
      ),
      posthogFetch(
        '/insights/trend/',
        {
          events: [{ id: '$pageview', math: 'total' }],
          date_from: dateFrom,
          properties: [{ key: '$current_url', value: '/entries', operator: 'icontains' }],
        },
        isPostHogTrendResponse,
      ),
      posthogFetch(
        '/insights/trend/',
        {
          events: [{ id: '$pageview', math: 'total' }],
          date_from: dateFrom,
          properties: [{ key: '$current_url', value: '/jar', operator: 'icontains' }],
        },
        isPostHogTrendResponse,
      ),
      posthogFetch(
        '/query/',
        {
          query: {
            kind: 'HogQLQuery',
            query: `SELECT
              count(DISTINCT $session_id) as sessions,
              avg(dateDiff('second', min_timestamp, max_timestamp)) as avg_duration
            FROM (
              SELECT $session_id, min(timestamp) as min_timestamp, max(timestamp) as max_timestamp
              FROM events
              WHERE timestamp >= now() - toIntervalDay(7) AND $session_id IS NOT NULL
              GROUP BY $session_id
            )`,
          },
        },
        isPostHogQueryResponse,
      ),
    ]);

    const totalPageviews = pvRes?.result[0]?.data.reduce((s: number, v: number) => s + v, 0) ?? 0;
    const entryPageViews =
      entryPvRes?.result[0]?.data.reduce((s: number, v: number) => s + v, 0) ?? 0;
    const jarPageViews = jarPvRes?.result[0]?.data.reduce((s: number, v: number) => s + v, 0) ?? 0;

    const sessionRow = sessionRes?.results[0];
    const totalSessions = typeof sessionRow?.[0] === 'number' ? sessionRow[0] : 0;
    const avgSessionDurationSeconds = typeof sessionRow?.[1] === 'number' ? sessionRow[1] : 0;

    return c.json({
      totalPageviews,
      totalSessions,
      avgSessionDurationSeconds: Math.round(avgSessionDurationSeconds),
      entryPageViews,
      jarPageViews,
    });
  })
  .get('/pages', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';

    const res = await posthogFetch(
      '/insights/trend/',
      {
        events: [{ id: '$pageview', math: 'total' }],
        date_from: dateFrom,
        breakdown: '$pathname',
        breakdown_type: 'event',
      },
      isPostHogTrendResponse,
    );

    const pages = (res?.result ?? [])
      .map((r) => ({
        path: r.label,
        views: r.data.reduce((s: number, v: number) => s + v, 0),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    return c.json({ data: pages });
  })
  .get('/daily', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';

    const [pvRes, sessionRes] = await Promise.all([
      posthogFetch(
        '/insights/trend/',
        {
          events: [{ id: '$pageview', math: 'total' }],
          date_from: dateFrom,
          interval: 'day',
        },
        isPostHogTrendResponse,
      ),
      posthogFetch(
        '/insights/trend/',
        {
          events: [{ id: '$pageview', math: 'dau' }],
          date_from: dateFrom,
          interval: 'day',
        },
        isPostHogTrendResponse,
      ),
    ]);

    const pvData = pvRes?.result[0];
    const sessionData = sessionRes?.result[0];

    const days = pvData?.days ?? [];
    const daily = days.map((date, i) => ({
      date,
      pageviews: pvData?.data[i] ?? 0,
      uniqueUsers: sessionData?.data[i] ?? 0,
    }));

    return c.json({ data: daily });
  });
