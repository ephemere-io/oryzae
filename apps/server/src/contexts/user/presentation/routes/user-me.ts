import { completeOnboardingSchema } from '@oryzae/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { UserProfileNotFoundError } from '../../application/errors/user.errors.js';
import { CompleteOnboardingUsecase } from '../../application/usecases/complete-onboarding.usecase.js';
import { GetUserMeUsecase } from '../../application/usecases/get-user-me.usecase.js';
import { SupabaseUserActivityStatsRepository } from '../../infrastructure/repositories/supabase-user-activity-stats.repository.js';
import { SupabaseUserProfileRepository } from '../../infrastructure/repositories/supabase-user-profile.repository.js';

type Env = {
  Variables: {
    userId: string;
    supabase: SupabaseClient;
  };
};

export const userMe = new Hono<Env>()
  .get('/', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const usecase = new GetUserMeUsecase(
      new SupabaseUserProfileRepository(supabase),
      new SupabaseUserActivityStatsRepository(supabase),
    );

    try {
      const view = await usecase.execute(userId);
      return c.json(view);
    } catch (e) {
      if (e instanceof UserProfileNotFoundError) {
        return c.json({ error: 'Profile not found' }, 404);
      }
      throw e;
    }
  })
  .patch('/onboarding', async (c) => {
    completeOnboardingSchema.parse(await c.req.json());
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const profileRepo = new SupabaseUserProfileRepository(supabase);
    const usecase = new CompleteOnboardingUsecase(profileRepo);

    const result = await usecase.execute(userId);
    return c.json({ onboardingCompleted: result.onboardingCompleted });
  })
  .get('/stats', async (c) => {
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

    const totalEntries = entries.length;
    const totalChars = entries.reduce((sum, e) => sum + (e.content?.length ?? 0), 0);
    const totalFermentations = fermentations.filter((f) => f.status === 'completed').length;

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
    if (!entryDates.has(checkDate.toISOString().slice(0, 10))) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (entryDates.has(checkDate.toISOString().slice(0, 10))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

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
