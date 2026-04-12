import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

export const adminUsers = new Hono<Env>().get('/', async (c) => {
  const supabase = c.get('adminSupabase');

  const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = usersData?.users ?? [];

  const userIds = users.map((u) => u.id);

  const [entriesRes, questionsRes, fermentationsRes] = await Promise.all([
    supabase.from('entries').select('user_id').in('user_id', userIds),
    supabase.from('questions').select('user_id').in('user_id', userIds),
    supabase.from('fermentation_results').select('user_id, status').in('user_id', userIds),
  ]);

  const entryCounts = new Map<string, number>();
  for (const row of entriesRes.data ?? []) {
    entryCounts.set(row.user_id, (entryCounts.get(row.user_id) ?? 0) + 1);
  }

  const questionCounts = new Map<string, number>();
  for (const row of questionsRes.data ?? []) {
    questionCounts.set(row.user_id, (questionCounts.get(row.user_id) ?? 0) + 1);
  }

  const fermentationStats = new Map<string, { total: number; completed: number; failed: number }>();
  for (const row of fermentationsRes.data ?? []) {
    const current = fermentationStats.get(row.user_id) ?? { total: 0, completed: 0, failed: 0 };
    current.total++;
    if (row.status === 'completed') current.completed++;
    if (row.status === 'failed') current.failed++;
    fermentationStats.set(row.user_id, current);
  }

  const result = users.map((u) => {
    const ferm = fermentationStats.get(u.id) ?? { total: 0, completed: 0, failed: 0 };
    return {
      id: u.id,
      email: u.email ?? '',
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      entryCount: entryCounts.get(u.id) ?? 0,
      questionCount: questionCounts.get(u.id) ?? 0,
      fermentationTotal: ferm.total,
      fermentationCompleted: ferm.completed,
      fermentationFailed: ferm.failed,
    };
  });

  return c.json({ users: result });
});
