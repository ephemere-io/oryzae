import type { SupabaseClient } from '@supabase/supabase-js';
import { gateway } from 'ai';
import { Hono } from 'hono';
import { fetchDailyCosts, sumDailyCosts } from '../../infrastructure/anthropic-cost-report.js';
import { computeCostFromTokens } from '../../infrastructure/claude-pricing.js';

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
          supabase
            .from('fermentation_results')
            .select('id', { count: 'exact', head: true })
            .not('generation_id', 'is', null),
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

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const currentMonthStart = new Date(currentYear, currentMonth, 1).toISOString();
    const currentMonthEnd = now.toISOString();

    const lastMonthStart = new Date(currentYear, currentMonth - 1, 1).toISOString();
    const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999).toISOString();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysElapsed = now.getDate();

    // issue #352 で generation_id が出なくなったため、トークン保存分 (input_tokens/
    // output_tokens) から価格算出する。旧 generation_id レコードは gateway フォールバック。
    // (/costs エンドポイントと同じ方式。これをやらないと monthly cost が常に $0.00 になる)
    const [currentMonthRows, lastMonthRows] = await Promise.all([
      supabase
        .from('fermentation_results')
        .select('generation_id, input_tokens, output_tokens')
        .or('input_tokens.not.is.null,generation_id.not.is.null')
        .gte('created_at', currentMonthStart)
        .lte('created_at', currentMonthEnd),
      supabase
        .from('fermentation_results')
        .select('generation_id, input_tokens, output_tokens')
        .or('input_tokens.not.is.null,generation_id.not.is.null')
        .gte('created_at', lastMonthStart)
        .lte('created_at', lastMonthEnd),
    ]);

    const sumCosts = async (
      rows: {
        generation_id: string | null;
        input_tokens: number | null;
        output_tokens: number | null;
      }[],
    ): Promise<number> => {
      let total = 0;
      await Promise.all(
        rows.map(async (row) => {
          const tokenCost = computeCostFromTokens(row.input_tokens, row.output_tokens);
          if (tokenCost) {
            total += tokenCost.totalCost;
            return;
          }
          if (row.generation_id) {
            try {
              const info = await gateway.getGenerationInfo({ id: row.generation_id });
              if (typeof info?.totalCost === 'number') total += info.totalCost;
            } catch {
              // skip failed lookups
            }
          }
        }),
      );
      return total;
    };

    // 正は Anthropic の Cost Report（実請求額）。自前のトークン × 価格表では
    // キャッシュ割引・コンテキスト窓別単価・tier 割引・期間限定価格を追えないため。
    // Admin キー未設定や API 失敗時だけ、従来の概算にフォールバックする。
    const [currentMonthBilled, lastMonthBilled] = await Promise.all([
      fetchDailyCosts(currentMonthStart, currentMonthEnd),
      fetchDailyCosts(lastMonthStart, lastMonthEnd),
    ]);

    const billed = currentMonthBilled !== null && lastMonthBilled !== null;
    const currentMonthCost = billed
      ? sumDailyCosts(currentMonthBilled)
      : await sumCosts(currentMonthRows.data ?? []);
    const lastMonthCost = billed
      ? sumDailyCosts(lastMonthBilled)
      : await sumCosts(lastMonthRows.data ?? []);

    const projectedCost = daysElapsed > 0 ? (currentMonthCost / daysElapsed) * daysInMonth : 0;

    return c.json({
      currentMonthCost: Math.round(currentMonthCost * 1000000) / 1000000,
      lastMonthCost: Math.round(lastMonthCost * 1000000) / 1000000,
      projectedCost: Math.round(projectedCost * 1000000) / 1000000,
      daysElapsed,
      daysInMonth,
      // 'billed' = Anthropic の実請求額 / 'estimate' = 自前トークンからの概算。
      // 画面側でどちらの数字を見ているか分かるように出す。
      source: billed ? 'billed' : 'estimate',
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
