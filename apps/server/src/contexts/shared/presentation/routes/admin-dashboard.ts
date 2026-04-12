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

  const [usersRes, entriesRes, allFermRes, completedRes, failedRes, costTrackedRes] =
    await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from('entries').select('id', { count: 'exact', head: true }),
      supabase.from('fermentation_results').select('id', { count: 'exact', head: true }),
      supabase
        .from('fermentation_results')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabase
        .from('fermentation_results')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),
      supabase
        .from('fermentation_results')
        .select('id', { count: 'exact', head: true })
        .not('generation_id', 'is', null),
    ]);

  return c.json({
    totalUsers: usersRes.data?.users?.length ?? 0,
    totalEntries: entriesRes.count ?? 0,
    totalFermentations: allFermRes.count ?? 0,
    completedFermentations: completedRes.count ?? 0,
    failedFermentations: failedRes.count ?? 0,
    fermentationsWithCostTracking: costTrackedRes.count ?? 0,
  });
});
