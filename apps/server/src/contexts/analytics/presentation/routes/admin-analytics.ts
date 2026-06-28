import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { PostHogGateway } from '../../infrastructure/posthog.gateway.js';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

const analytics = new PostHogGateway();

function sumData(data: number[]): number {
  return data.reduce((s, v) => s + v, 0);
}

// 期間セレクタの date_from/date_to を HogQL の WHERE 句に変換する。
// HogQL は文字列補間になるため、インジェクション防止に YYYY-MM-DD のみ受け付け、
// それ以外（'-7d' 等の相対や不正値）は安全な相対既定 (直近7日) にフォールバックする。
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function hogqlTimeFilter(dateFrom: string, dateTo?: string): string {
  if (!DATE_RE.test(dateFrom)) {
    return 'timestamp >= now() - toIntervalDay(7)';
  }
  const lower = `timestamp >= toDateTime('${dateFrom} 00:00:00')`;
  return dateTo && DATE_RE.test(dateTo)
    ? `${lower} AND timestamp <= toDateTime('${dateTo} 23:59:59')`
    : lower;
}

export const adminAnalytics = new Hono<Env>()
  .get('/overview', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';
    const dateTo = c.req.query('date_to');
    const pageviewEvent = [{ id: '$pageview', math: 'total' }];

    const [pvResults, entryPvResults, jarPvResults, sessionRows] = await Promise.all([
      analytics.queryTrend({ dateFrom, dateTo, events: pageviewEvent }),
      analytics.queryTrend({
        dateFrom,
        dateTo,
        events: pageviewEvent,
        properties: [{ key: '$current_url', value: '/entries', operator: 'icontains' }],
      }),
      analytics.queryTrend({
        dateFrom,
        dateTo,
        events: pageviewEvent,
        properties: [{ key: '$current_url', value: '/jar', operator: 'icontains' }],
      }),
      // セッション数/平均滞在は HogQL。以前は now()-7日 固定で、期間を切り替えても
      // pageviews だけ変わって sessions が動かない不整合だった。選択期間を反映する。
      analytics.queryHogQL(`SELECT
        count(DISTINCT $session_id) as sessions,
        avg(dateDiff('second', min_timestamp, max_timestamp)) as avg_duration
      FROM (
        SELECT $session_id, min(timestamp) as min_timestamp, max(timestamp) as max_timestamp
        FROM events
        WHERE ${hogqlTimeFilter(dateFrom, dateTo)} AND $session_id IS NOT NULL
        GROUP BY $session_id
      )`),
    ]);

    const sessionRow = sessionRows[0];
    const totalSessions = typeof sessionRow?.[0] === 'number' ? sessionRow[0] : 0;
    const avgDuration = typeof sessionRow?.[1] === 'number' ? sessionRow[1] : 0;

    return c.json({
      totalPageviews: sumData(pvResults[0]?.data ?? []),
      totalSessions,
      avgSessionDurationSeconds: Math.round(avgDuration),
      entryPageViews: sumData(entryPvResults[0]?.data ?? []),
      jarPageViews: sumData(jarPvResults[0]?.data ?? []),
    });
  })
  .get('/pages', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';
    const dateTo = c.req.query('date_to');

    const results = await analytics.queryTrend({
      dateFrom,
      dateTo,
      events: [{ id: '$pageview', math: 'total' }],
      breakdown: '$pathname',
      breakdownType: 'event',
    });

    const pages = results
      .map((r) => ({ path: r.label, views: sumData(r.data) }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20);

    return c.json({ data: pages });
  })
  .get('/daily', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';
    const dateTo = c.req.query('date_to');

    const [pvResults, dauResults] = await Promise.all([
      analytics.queryTrend({
        dateFrom,
        dateTo,
        events: [{ id: '$pageview', math: 'total' }],
        interval: 'day',
      }),
      analytics.queryTrend({
        dateFrom,
        dateTo,
        events: [{ id: '$pageview', math: 'dau' }],
        interval: 'day',
      }),
    ]);

    const pvData = pvResults[0];
    const dauData = dauResults[0];
    const days = pvData?.days ?? [];

    const daily = days.map((date, i) => ({
      date,
      pageviews: pvData?.data[i] ?? 0,
      uniqueUsers: dauData?.data[i] ?? 0,
    }));

    return c.json({ data: daily });
  });
