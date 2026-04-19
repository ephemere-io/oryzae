import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';

type Env = {
  Variables: {
    userId: string;
    supabase: SupabaseClient;
  };
};

export const userStats = new Hono<Env>().get('/stats', async (c) => {
  const userId = c.get('userId');
  const supabase = c.get('supabase');

  const [entriesRes, fermentationsRes] = await Promise.all([
    supabase
      .from('entries')
      .select('id, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase.from('fermentation_results').select('id, status').eq('user_id', userId),
  ]);

  const entries = entriesRes.data ?? [];
  const fermentations = fermentationsRes.data ?? [];

  // Total entries and chars
  const totalEntries = entries.length;
  const totalChars = entries.reduce((sum, e) => sum + (e.content?.length ?? 0), 0);

  // Total fermentations
  const totalFermentations = fermentations.filter((f) => f.status === 'completed').length;

  // Streak calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entryDates = new Set(
    entries.map((e) => {
      const d = new Date(e.created_at);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    }),
  );

  let streak = 0;
  const checkDate = new Date(today);
  // Check if today has an entry, if not start from yesterday
  if (!entryDates.has(checkDate.toISOString().slice(0, 10))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  while (entryDates.has(checkDate.toISOString().slice(0, 10))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Weekly and monthly chars
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const weeklyChars = entries
    .filter((e) => new Date(e.created_at) >= weekAgo)
    .reduce((sum, e) => sum + (e.content?.length ?? 0), 0);

  const monthlyChars = entries
    .filter((e) => new Date(e.created_at) >= monthAgo)
    .reduce((sum, e) => sum + (e.content?.length ?? 0), 0);

  // Monthly trend (last 12 months)
  const monthlyTrend: { month: string; entries: number; chars: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthEntries = entries.filter((e) => e.created_at.startsWith(monthKey));
    monthlyTrend.push({
      month: monthKey,
      entries: monthEntries.length,
      chars: monthEntries.reduce((sum, e) => sum + (e.content?.length ?? 0), 0),
    });
  }

  // Entries by question
  const { data: links } = await supabase
    .from('entry_question_links')
    .select('question_id')
    .in(
      'entry_id',
      entries.map((e) => e.id),
    );

  const questionCounts = new Map<string, number>();
  for (const link of links ?? []) {
    questionCounts.set(link.question_id, (questionCounts.get(link.question_id) ?? 0) + 1);
  }

  // Get question texts
  const questionIds = [...questionCounts.keys()];
  const entriesByQuestion: { questionId: string; questionText: string; count: number }[] = [];
  if (questionIds.length > 0) {
    const { data: transactions } = await supabase
      .from('question_transactions')
      .select('question_id, string')
      .in('question_id', questionIds)
      .eq('is_validated_by_user', true)
      .order('question_version', { ascending: false });

    const textMap = new Map<string, string>();
    for (const t of transactions ?? []) {
      if (!textMap.has(t.question_id)) {
        textMap.set(t.question_id, t.string);
      }
    }

    for (const [qId, count] of questionCounts) {
      entriesByQuestion.push({
        questionId: qId,
        questionText: textMap.get(qId) ?? '',
        count,
      });
    }
    entriesByQuestion.sort((a, b) => b.count - a.count);
  }

  return c.json({
    streak,
    totalEntries,
    totalChars,
    totalFermentations,
    weeklyChars,
    monthlyChars,
    entriesByQuestion,
    monthlyTrend,
  });
});
