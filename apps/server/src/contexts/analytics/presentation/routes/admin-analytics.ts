import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { PostHogGateway, PostHogUnavailableError } from '../../infrastructure/posthog.gateway.js';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

const analytics = new PostHogGateway();

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

// daily 系列を埋めるための連続日付（YYYY-MM-DD）。選択期間が YYYY-MM-DD のときはそれを使い、
// 相対/未指定のときは直近7日にフォールバックする（hogqlTimeFilter と同じ既定）。
function enumerateDates(dateFrom: string, dateTo?: string): string[] {
  const end = dateTo && DATE_RE.test(dateTo) ? new Date(`${dateTo}T00:00:00.000Z`) : new Date();
  const start = DATE_RE.test(dateFrom)
    ? new Date(`${dateFrom}T00:00:00.000Z`)
    : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function numAt(row: unknown[] | undefined, i: number): number {
  const v = row?.[i];
  return typeof v === 'number' ? v : 0;
}

function strAt(row: unknown[] | undefined, i: number): string | null {
  const v = row?.[i];
  return typeof v === 'string' ? v : null;
}

// PostHog 取得失敗を画面に伝える。status 0 = 未設定、それ以外 = PostHog の HTTP コード。
function posthogError(err: unknown): { status: 502 | 503; message: string } | null {
  if (err instanceof PostHogUnavailableError) {
    return err.status === 0
      ? {
          status: 503,
          message: 'PostHog が未設定です（POSTHOG_PERSONAL_API_KEY を確認してください）',
        }
      : { status: 502, message: `PostHog の取得に失敗しました (HTTP ${err.status})` };
  }
  return null;
}

export const adminAnalytics = new Hono<Env>()
  .get('/overview', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';
    const dateTo = c.req.query('date_to');
    const time = hogqlTimeFilter(dateFrom, dateTo);

    try {
      const [aggRows, sessionRows] = await Promise.all([
        // pageview 総数 / entries / jar をまとめて 1 クエリで集計。
        analytics.queryHogQL(`SELECT
          countIf(event = '$pageview') AS total_pv,
          countIf(event = '$pageview' AND properties.$current_url ILIKE '%/entries%') AS entry_pv,
          countIf(event = '$pageview' AND properties.$current_url ILIKE '%/jar%') AS jar_pv
        FROM events
        WHERE ${time}`),
        // セッション数 / 平均滞在。選択期間を反映する。
        analytics.queryHogQL(`SELECT
          count(DISTINCT $session_id) as sessions,
          avg(dateDiff('second', min_timestamp, max_timestamp)) as avg_duration
        FROM (
          SELECT $session_id, min(timestamp) as min_timestamp, max(timestamp) as max_timestamp
          FROM events
          WHERE ${time} AND $session_id IS NOT NULL
          GROUP BY $session_id
        )`),
      ]);

      const agg = aggRows[0];
      const session = sessionRows[0];

      return c.json({
        totalPageviews: numAt(agg, 0),
        entryPageViews: numAt(agg, 1),
        jarPageViews: numAt(agg, 2),
        totalSessions: numAt(session, 0),
        avgSessionDurationSeconds: Math.round(numAt(session, 1)),
      });
    } catch (err) {
      const pe = posthogError(err);
      if (pe) return c.json({ error: pe.message }, pe.status);
      throw err;
    }
  })
  .get('/pages', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';
    const dateTo = c.req.query('date_to');
    const time = hogqlTimeFilter(dateFrom, dateTo);

    try {
      const rows = await analytics.queryHogQL(`SELECT properties.$pathname AS path, count() AS views
        FROM events
        WHERE event = '$pageview' AND ${time} AND properties.$pathname IS NOT NULL
        GROUP BY path
        ORDER BY views DESC
        LIMIT 20`);

      const pages = rows
        .map((row) => ({ path: strAt(row, 0) ?? '(unknown)', views: numAt(row, 1) }))
        .filter((p) => p.views > 0);

      return c.json({ data: pages });
    } catch (err) {
      const pe = posthogError(err);
      if (pe) return c.json({ error: pe.message }, pe.status);
      throw err;
    }
  })
  .get('/daily', async (c) => {
    const dateFrom = c.req.query('date_from') ?? '-7d';
    const dateTo = c.req.query('date_to');
    const time = hogqlTimeFilter(dateFrom, dateTo);

    try {
      const rows = await analytics.queryHogQL(`SELECT
        toDate(timestamp) AS day,
        count() AS pageviews,
        count(DISTINCT person_id) AS unique_users
      FROM events
      WHERE event = '$pageview' AND ${time}
      GROUP BY day
      ORDER BY day`);

      // 日付 -> 集計値。HogQL の day は 'YYYY-MM-DD' 文字列で返る。
      const byDate = new Map<string, { pageviews: number; uniqueUsers: number }>();
      for (const row of rows) {
        const day = strAt(row, 0);
        if (!day) continue;
        byDate.set(day.slice(0, 10), { pageviews: numAt(row, 1), uniqueUsers: numAt(row, 2) });
      }

      // 欠損日も 0 で埋めて連続系列にする（グラフ/ヒートマップが連続前提のため）。
      const daily = enumerateDates(dateFrom, dateTo).map((date) => {
        const hit = byDate.get(date);
        return { date, pageviews: hit?.pageviews ?? 0, uniqueUsers: hit?.uniqueUsers ?? 0 };
      });

      return c.json({ data: daily });
    } catch (err) {
      const pe = posthogError(err);
      if (pe) return c.json({ error: pe.message }, pe.status);
      throw err;
    }
  });
