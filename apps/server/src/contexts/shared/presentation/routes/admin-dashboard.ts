import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { fetchActualCost } from '../../infrastructure/anthropic-cost-api.js';
import {
  aggregateCost,
  fetchFermentationCostRows,
} from '../../infrastructure/fermentation-cost-query.js';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

// 現在期間と「直前の同じ長さの期間」を解決する（リテンション比較用）。
// date_from/date_to は YYYY-MM-DD（セレクタ）。未指定時は直近7日 / now にフォールバック。
export function resolveActivityPeriods(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  now: Date,
): { currentStart: string; currentEnd: string; previousStart: string; previousEnd: string } {
  const currentStart = dateFrom
    ? new Date(`${dateFrom}T00:00:00.000Z`)
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const currentEnd = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : now;
  // 期間長（最低1日）。直前期間は [currentStart - 期間長, currentStart) とする。
  const periodMs = Math.max(currentEnd.getTime() - currentStart.getTime(), 24 * 60 * 60 * 1000);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(currentStart.getTime() - periodMs);
  return {
    currentStart: currentStart.toISOString(),
    currentEnd: currentEnd.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  };
}

// 現在/直前期間の投稿者から、アクティブ数・直前アクティブ数・継続(両方に出現)数を数える。
export function countReturning(
  currentUserIds: string[],
  previousUserIds: string[],
): { activeWriters: number; previousActiveUsers: number; returningUsers: number } {
  const current = new Set(currentUserIds);
  const previous = new Set(previousUserIds);
  let returning = 0;
  for (const id of current) {
    if (previous.has(id)) returning++;
  }
  return {
    activeWriters: current.size,
    previousActiveUsers: previous.size,
    returningUsers: returning,
  };
}

export const adminDashboard = new Hono<Env>()
  .get('/stats', async (c) => {
    const supabase = c.get('adminSupabase');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    type DateFilterable = {
      gte: (col: string, val: string) => DateFilterable;
      lte: (col: string, val: string) => DateFilterable;
    };
    const applyDateFilter = <T>(query: T): T => {
      // @type-assertion-allowed: Supabase 2.105 で `T extends { gte/lte... }` の generic 制約が型インスタンス化深度を超えて TS2589 を起こす。runtime は同じ method chain なので、generic を緩めて中で DateFilterable に narrow する。
      let q = query as unknown as DateFilterable;
      if (dateFrom) q = q.gte('created_at', dateFrom);
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999Z`);
      // @type-assertion-allowed: 上の理由と同じく、型を元の builder 型に戻す。runtime では同じオブジェクトの chain。
      return q as unknown as T;
    };

    const [usersRes, entriesRes, allFermRes, completedRes, failedRes, costTrackedRes] =
      await Promise.all([
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        applyDateFilter(supabase.from('entries').select('id', { count: 'exact', head: true })),
        applyDateFilter(
          supabase.from('fermentation_results').select('id', { count: 'exact', head: true }),
        ),
        applyDateFilter(
          supabase
            .from('fermentation_results')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'completed'),
        ),
        applyDateFilter(
          supabase
            .from('fermentation_results')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'failed'),
        ),
        applyDateFilter(
          // issue #352 以降 generation_id は NULL 固定。旧条件のままだと
          // 「コスト追跡済み」が常に 0 件になるため、トークン保存有無で数える
          // （旧 generation_id 方式のレコードも追跡済みとして拾う）。
          supabase
            .from('fermentation_results')
            .select('id', { count: 'exact', head: true })
            .or('input_tokens.not.is.null,generation_id.not.is.null'),
        ),
      ]);

    return c.json({
      totalUsers: usersRes.data?.users?.length ?? 0,
      totalEntries: entriesRes.count ?? 0,
      totalFermentations: allFermRes.count ?? 0,
      completedFermentations: completedRes.count ?? 0,
      failedFermentations: failedRes.count ?? 0,
      fermentationsWithCostTracking: costTrackedRes.count ?? 0,
    });
  })
  .get('/failures-24h', async (c) => {
    const supabase = c.get('adminSupabase');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('fermentation_results')
      .select('id, user_id, question_id, error_message, created_at')
      .eq('status', 'failed')
      .gt('created_at', since);

    if (error) return c.json({ error: error.message }, 500);

    const rows = data ?? [];

    // Group by user_id
    const grouped = new Map<
      string,
      {
        id: string;
        questionId: string;
        errorMessage: string | null;
        createdAt: string;
      }[]
    >();
    for (const row of rows) {
      const list = grouped.get(row.user_id) ?? [];
      list.push({
        id: row.id,
        questionId: row.question_id,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      });
      grouped.set(row.user_id, list);
    }

    // Get user emails
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      emailMap.set(u.id, u.email ?? '');
    }

    const groups = Array.from(grouped.entries()).map(([userId, failures]) => ({
      userId,
      email: emailMap.get(userId) ?? '',
      failures,
    }));

    return c.json({ groups });
  })
  .get('/trends', async (c) => {
    const supabase = c.get('adminSupabase');
    const dateFromParam = c.req.query('date_from');
    const dateToParam = c.req.query('date_to');

    // Determine date range
    const endDate = dateToParam ? new Date(dateToParam) : new Date();
    const startDate = dateFromParam
      ? new Date(dateFromParam)
      : new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Build list of dates
    const dates: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Fetch all data in the range at once (much faster than per-day queries)
    const rangeStart = `${dates[0]}T00:00:00.000Z`;
    const rangeEnd = `${dates[dates.length - 1]}T23:59:59.999Z`;

    const [fermRes, entriesRes] = await Promise.all([
      supabase
        .from('fermentation_results')
        .select('status, created_at')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('entries')
        .select('user_id, created_at')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
    ]);

    const fermentations = fermRes.data ?? [];
    const entries = entriesRes.data ?? [];

    // Group by date
    const days = dates.map((dateStr) => {
      const dayFerms = fermentations.filter((f) => f.created_at.slice(0, 10) === dateStr);
      const dayEntries = entries.filter((e) => e.created_at.slice(0, 10) === dateStr);
      const total = dayFerms.length;
      const completed = dayFerms.filter((f) => f.status === 'completed').length;
      const uniqueWriters = new Set(dayEntries.map((e) => e.user_id));

      return {
        date: dateStr,
        totalFermentations: total,
        completedFermentations: completed,
        activeWriters: uniqueWriters.size,
      };
    });

    return c.json({ days });
  })
  .get('/cost-summary', async (c) => {
    const supabase = c.get('adminSupabase');

    // 月境界は UTC で切る。Anthropic の cost_report が UTC 日バケット固定なので、
    // 実額と推定を同じ窓で並べないと乖離が読めなくなるため。
    // (日次レポートは運用に合わせて JST 日で切る。cron-cost-alert.ts を参照)
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-indexed

    const currentMonthStart = new Date(Date.UTC(currentYear, currentMonth, 1));
    const lastMonthStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));

    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    const daysElapsed = now.getUTCDate();

    const [currentRows, lastRows, currentActual, lastActual] = await Promise.all([
      fetchFermentationCostRows(supabase, {
        startIso: currentMonthStart.toISOString(),
        endIso: now.toISOString(),
      }),
      fetchFermentationCostRows(supabase, {
        startIso: lastMonthStart.toISOString(),
        endIso: new Date(currentMonthStart.getTime() - 1).toISOString(),
      }),
      fetchActualCost(currentMonthStart, now),
      fetchActualCost(lastMonthStart, currentMonthStart),
    ]);

    const currentAggregate = aggregateCost(currentRows.rows);
    const lastAggregate = aggregateCost(lastRows.rows);

    // 着地見込みは実額があれば実額ベース、無ければ推定ベース。
    const projectionBasis =
      currentActual.kind === 'ok' ? currentActual.totalCostUsd : currentAggregate.estimatedCostUsd;
    const projectedCost = daysElapsed > 0 ? (projectionBasis / daysElapsed) * daysInMonth : 0;

    const round = (n: number) => Math.round(n * 1000000) / 1000000;

    return c.json({
      // 実請求額 (Anthropic cost_report)。未設定・取得失敗を $0 と区別できるよう
      // status を必ず添えて返す。フロントは status を見て表示を出し分けること。
      actual: {
        status: currentActual.kind,
        currentMonthCost: currentActual.kind === 'ok' ? round(currentActual.totalCostUsd) : null,
        lastMonthCost: lastActual.kind === 'ok' ? round(lastActual.totalCostUsd) : null,
        message: currentActual.kind === 'error' ? currentActual.message : null,
      },
      // 推定値 (保存トークン × 価格表)。ユーザー別内訳を出せる唯一の系統。
      estimated: {
        currentMonthCost: round(currentAggregate.estimatedCostUsd),
        lastMonthCost: round(lastAggregate.estimatedCostUsd),
        untrackedCount: currentAggregate.untrackedCount,
        truncated: currentRows.truncated || lastRows.truncated,
      },
      projectedCost: round(projectedCost),
      projectionBasis: currentActual.kind === 'ok' ? 'actual' : 'estimated',
      daysElapsed,
      daysInMonth,
    });
  })
  .get('/user-activity', async (c) => {
    const supabase = c.get('adminSupabase');

    // 期間セレクタ (date_from/date_to) を尊重する。未指定時のみ直近7日にフォールバック。
    // 直前の同じ長さの期間も取り、継続(リテンション)ユーザーを算出する。
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const periods = resolveActivityPeriods(dateFrom, dateTo, new Date());

    const [currentRes, previousRes, usersRes] = await Promise.all([
      supabase
        .from('entries')
        .select('user_id')
        .gte('created_at', periods.currentStart)
        .lte('created_at', periods.currentEnd),
      supabase
        .from('entries')
        .select('user_id')
        .gte('created_at', periods.previousStart)
        .lte('created_at', periods.previousEnd),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const counts = countReturning(
      (currentRes.data ?? []).map((r) => r.user_id),
      (previousRes.data ?? []).map((r) => r.user_id),
    );

    return c.json({
      activeWriters: counts.activeWriters,
      totalUsers: usersRes.data?.users?.length ?? 0,
      returningUsers: counts.returningUsers,
      previousActiveUsers: counts.previousActiveUsers,
    });
  });
