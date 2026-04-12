import type { SupabaseClient } from '@supabase/supabase-js';
import { gateway } from 'ai';
import { Hono } from 'hono';

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

    const applyDateFilter = <
      T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T },
    >(
      query: T,
    ): T => {
      let q = query;
      if (dateFrom) q = q.gte('created_at', dateFrom);
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999Z`);
      return q;
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
      .select('id, user_id, question_id, entry_id, error_message, created_at')
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
        entryId: string;
        errorMessage: string | null;
        createdAt: string;
      }[]
    >();
    for (const row of rows) {
      const list = grouped.get(row.user_id) ?? [];
      list.push({
        id: row.id,
        questionId: row.question_id,
        entryId: row.entry_id,
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

    const days: {
      date: string;
      totalFermentations: number;
      completedFermentations: number;
      activeWriters: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayStart = `${dateStr}T00:00:00.000Z`;
      const dayEnd = `${dateStr}T23:59:59.999Z`;

      const [totalRes, completedRes, writersRes] = await Promise.all([
        supabase
          .from('fermentation_results')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
        supabase
          .from('fermentation_results')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
        supabase
          .from('entries')
          .select('user_id')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd),
      ]);

      const uniqueWriters = new Set((writersRes.data ?? []).map((r) => r.user_id));

      days.push({
        date: dateStr,
        totalFermentations: totalRes.count ?? 0,
        completedFermentations: completedRes.count ?? 0,
        activeWriters: uniqueWriters.size,
      });
    }

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

    const [currentMonthRows, lastMonthRows] = await Promise.all([
      supabase
        .from('fermentation_results')
        .select('generation_id')
        .not('generation_id', 'is', null)
        .gte('created_at', currentMonthStart)
        .lte('created_at', currentMonthEnd),
      supabase
        .from('fermentation_results')
        .select('generation_id')
        .not('generation_id', 'is', null)
        .gte('created_at', lastMonthStart)
        .lte('created_at', lastMonthEnd),
    ]);

    const sumCosts = async (rows: { generation_id: string }[]): Promise<number> => {
      let total = 0;
      await Promise.all(
        rows.map(async (row) => {
          try {
            const info = await gateway.getGenerationInfo({ id: row.generation_id });
            if (typeof info?.totalCost === 'number') {
              total += info.totalCost;
            }
          } catch {
            // skip failed lookups
          }
        }),
      );
      return total;
    };

    const currentMonthCost = await sumCosts(
      (currentMonthRows.data ?? []).filter(
        (r): r is { generation_id: string } => r.generation_id !== null,
      ),
    );
    const lastMonthCost = await sumCosts(
      (lastMonthRows.data ?? []).filter(
        (r): r is { generation_id: string } => r.generation_id !== null,
      ),
    );

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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [writersRes, usersRes] = await Promise.all([
      supabase.from('entries').select('user_id').gt('created_at', sevenDaysAgo),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const uniqueWriters = new Set((writersRes.data ?? []).map((r) => r.user_id));

    return c.json({
      activeWriters: uniqueWriters.size,
      totalUsers: usersRes.data?.users?.length ?? 0,
    });
  });
