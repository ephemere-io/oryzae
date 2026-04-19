import { Hono } from 'hono';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntryQuestionLinkRepository } from '../../../question/infrastructure/repositories/supabase-entry-question-link.repository.js';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { SupabaseQuestionTransactionRepository } from '../../../question/infrastructure/repositories/supabase-question-transaction.repository.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { ScheduledFermentationUsecase } from '../../application/usecases/scheduled-fermentation.usecase.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';
import { getFermentationTargetDateKey } from './cron-target-date.js';

const generateId = () => crypto.randomUUID();

export const cronFermentation = new Hono()
  .use('*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return c.json({ error: 'CRON_SECRET not configured' }, 500);
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  })
  .post('/', async (c) => {
    const supabase = getSupabaseClient();

    const entryRepo = new SupabaseEntryRepository(supabase);
    const questionRepo = new SupabaseQuestionRepository(supabase);
    const questionTransactionRepo = new SupabaseQuestionTransactionRepository(supabase);
    const entryQuestionLinkRepo = new SupabaseEntryQuestionLinkRepository(supabase);
    const fermentationRepo = new SupabaseFermentationRepository(supabase);
    const llmGateway = new VercelAiAnalysisGateway();

    const listActiveUserIds = async (): Promise<string[]> => {
      // Get distinct user_ids from entries table (users who have written at least once)
      const { data, error } = await supabase.from('entries').select('user_id').limit(1000);

      if (error) throw error;

      const uniqueUserIds = [
        ...new Set((data ?? []).map((row: { user_id: string }) => row.user_id)),
      ];
      return uniqueUserIds;
    };

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      questionTransactionRepo,
      entryQuestionLinkRepo,
      fermentationRepo,
      llmGateway,
      generateId,
      listActiveUserIds,
    );

    // Cron は JST 03:00 に発火するため、対象は「直前に閉じた一日」= JST での前日
    const dateKey = getFermentationTargetDateKey(new Date());

    const result = await usecase.execute(dateKey);

    return c.json({
      message: 'Scheduled fermentation completed',
      dateKey,
      ...result,
    });
  });
