import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

export const adminUsers = new Hono<Env>()
  .get('/', async (c) => {
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

    const fermentationStats = new Map<
      string,
      { total: number; completed: number; failed: number }
    >();
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
  })
  .get('/:id', async (c) => {
    const supabase = c.get('adminSupabase');
    const userId = c.req.param('id');

    // 1. User profile from auth
    const {
      data: { user },
    } = await supabase.auth.admin.getUserById(userId);
    if (!user) return c.json({ error: 'User not found' }, 404);

    // 2. Entries (id, content length, created_at) - most recent 100
    const { data: entries } = await supabase
      .from('entries')
      .select('id, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // 3. Questions with latest transaction text
    const { data: questions } = await supabase
      .from('questions')
      .select('id, is_archived, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Get latest validated transaction for each question
    const questionIds = (questions ?? []).map((q: { id: string }) => q.id);
    const { data: transactions } =
      questionIds.length > 0
        ? await supabase
            .from('question_transactions')
            .select('question_id, string, question_version, is_validated_by_user')
            .in('question_id', questionIds)
            .eq('is_validated_by_user', true)
            .order('question_version', { ascending: false })
        : { data: [] };

    // Map latest text per question
    const latestTextMap = new Map<string, string>();
    for (const tx of transactions ?? []) {
      if (!latestTextMap.has(tx.question_id)) {
        latestTextMap.set(tx.question_id, tx.string);
      }
    }

    // 4. Fermentations
    const { data: fermentations } = await supabase
      .from('fermentation_results')
      .select('id, status, error_message, generation_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // 5. Entry dates for heatmap (past 365 days)
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const { data: entryDates } = await supabase
      .from('entries')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', yearAgo.toISOString());

    // Count entries per date
    const dateCountMap = new Map<string, number>();
    for (const e of entryDates ?? []) {
      const date = (e.created_at ?? '').slice(0, 10);
      dateCountMap.set(date, (dateCountMap.get(date) ?? 0) + 1);
    }

    return c.json({
      profile: {
        id: user.id,
        email: user.email ?? '',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      },
      entries: (entries ?? []).map(
        (e: { id: string; content: string | null; created_at: string }) => ({
          id: e.id,
          characterCount: (e.content ?? '').length,
          createdAt: e.created_at,
        }),
      ),
      questions: (questions ?? []).map(
        (q: { id: string; is_archived: boolean; created_at: string }) => ({
          id: q.id,
          text: latestTextMap.get(q.id) ?? '',
          isArchived: q.is_archived,
          createdAt: q.created_at,
        }),
      ),
      fermentations: (fermentations ?? []).map(
        (f: {
          id: string;
          status: string;
          error_message: string | null;
          generation_id: string | null;
          created_at: string;
        }) => ({
          id: f.id,
          status: f.status,
          errorMessage: f.error_message ?? null,
          hasGenerationId: !!f.generation_id,
          createdAt: f.created_at,
        }),
      ),
      entryDates: Array.from(dateCountMap.entries()).map(([date, count]) => ({ date, count })),
    });
  });
