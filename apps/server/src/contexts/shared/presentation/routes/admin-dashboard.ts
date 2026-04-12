import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

export const adminDashboard = new Hono<Env>().get('/stats', async (c) => {
  const supabase = c.get('adminSupabase');

  const [usersRes, entriesRes, fermentationsRes, fermentationsWithCostRes] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
    supabase.from('entries').select('id', { count: 'exact', head: true }),
    supabase.from('fermentation_results').select('id', { count: 'exact', head: true }),
    supabase
      .from('fermentation_results')
      .select('id', { count: 'exact', head: true })
      .not('generation_id', 'is', null),
  ]);

  return c.json({
    totalUsers: usersRes.data?.users?.length ?? 0,
    totalEntries: entriesRes.count ?? 0,
    totalFermentations: fermentationsRes.count ?? 0,
    fermentationsWithCostTracking: fermentationsWithCostRes.count ?? 0,
  });
});
