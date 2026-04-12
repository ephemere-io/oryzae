import type { SupabaseClient } from '@supabase/supabase-js';
import { gateway } from 'ai';
import { Hono } from 'hono';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

export const adminFermentations = new Hono<Env>()
  .get('/costs/by-user', async (c) => {
    const supabase = c.get('adminSupabase');

    const { data, error } = await supabase
      .from('fermentation_results')
      .select('user_id, generation_id')
      .not('generation_id', 'is', null);

    if (error) return c.json({ error: error.message }, 500);

    const costsByUser = new Map<string, { count: number; totalCost: number }>();
    await Promise.all(
      (data ?? []).map(async (row) => {
        try {
          const info = await gateway.getGenerationInfo({ id: row.generation_id });
          const cost = typeof info?.totalCost === 'number' ? info.totalCost : 0;
          const current = costsByUser.get(row.user_id) ?? { count: 0, totalCost: 0 };
          current.count++;
          current.totalCost += cost;
          costsByUser.set(row.user_id, current);
        } catch {
          // skip failed lookups
        }
      }),
    );

    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      emailMap.set(u.id, u.email ?? '');
    }

    const items = Array.from(costsByUser.entries())
      .map(([userId, stats]) => ({
        userId,
        email: emailMap.get(userId) ?? '',
        fermentationCount: stats.count,
        totalCostUsd: Math.round(stats.totalCost * 1000000) / 1000000,
      }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

    return c.json({ data: items });
  })
  .get('/', async (c) => {
    const supabase = c.get('adminSupabase');
    const page = Number(c.req.query('page') ?? '1');
    const limit = Number(c.req.query('limit') ?? '50');
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('fermentation_results')
      .select(
        'id, user_id, question_id, entry_id, target_period, status, generation_id, created_at, updated_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return c.json({ error: error.message }, 500);

    return c.json({
      data: data ?? [],
      pagination: { page, limit, total: count ?? 0 },
    });
  })
  .get('/:id/cost', async (c) => {
    const supabase = c.get('adminSupabase');
    const id = c.req.param('id');

    const { data, error } = await supabase
      .from('fermentation_results')
      .select('generation_id')
      .eq('id', id)
      .single();

    if (error || !data) return c.json({ error: 'Fermentation result not found' }, 404);

    if (!data.generation_id) {
      return c.json({ error: 'No generation ID available for cost tracking' }, 404);
    }

    const info = await gateway.getGenerationInfo({ id: data.generation_id });

    return c.json({
      fermentationResultId: id,
      generationId: data.generation_id,
      cost: info,
    });
  })
  .get('/costs', async (c) => {
    const supabase = c.get('adminSupabase');
    const page = Number(c.req.query('page') ?? '1');
    const limit = Number(c.req.query('limit') ?? '50');
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('fermentation_results')
      .select('id, user_id, status, generation_id, created_at', { count: 'exact' })
      .not('generation_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return c.json({ error: error.message }, 500);

    const items = await Promise.all(
      (data ?? []).map(async (row) => {
        try {
          const info = await gateway.getGenerationInfo({ id: row.generation_id });
          return { ...row, cost: info };
        } catch {
          return { ...row, cost: null };
        }
      }),
    );

    return c.json({
      data: items,
      pagination: { page, limit, total: count ?? 0 },
    });
  });
