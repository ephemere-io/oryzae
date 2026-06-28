import type { SupabaseClient } from '@supabase/supabase-js';
import { gateway } from 'ai';
import { Hono } from 'hono';
import { computeCostFromTokens } from '../../infrastructure/claude-pricing.js';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

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

    const currentMonthCost = await sumCosts(currentMonthRows.data ?? []);
    const lastMonthCost = await sumCosts(lastMonthRows.data ?? []);

    const projectedCost = daysElapsed > 0 ? (currentMonthCost / daysElapsed) * daysInMonth : 0;

    return c.json({
      currentMonthCost: Math.round(currentMonthCost * 1000000) / 1000000,
      lastMonthCost: Math.round(lastMonthCost * 1000000) / 1000000,
      projectedCost: Math.round(projectedCost * 1000000) / 1000000,
      daysElapsed,
      daysInMonth,
    });
  })
  .get('/user-activity', async (c) => {
    const supabase = c.get('adminSupabase');

    // 期間セレクタ (date_from/date_to) を尊重する。未指定時のみ直近7日にフォールバック。
    // 以前はここが 7日固定で、期間を切り替えても値が変わらなかった。
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const from = dateFrom ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let writersQuery = supabase.from('entries').select('user_id').gte('created_at', from);
    if (dateTo) writersQuery = writersQuery.lte('created_at', `${dateTo}T23:59:59.999Z`);

    const [writersRes, usersRes] = await Promise.all([
      writersQuery,
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const uniqueWriters = new Set((writersRes.data ?? []).map((r) => r.user_id));

    return c.json({
      activeWriters: uniqueWriters.size,
      totalUsers: usersRes.data?.users?.length ?? 0,
    });
  });
