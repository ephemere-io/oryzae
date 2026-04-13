import { Hono } from 'hono';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { SupabaseQuestionTransactionRepository } from '../../../question/infrastructure/repositories/supabase-question-transaction.repository.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { ScheduledFermentationUsecase } from '../../application/usecases/scheduled-fermentation.usecase.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';

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
      fermentationRepo,
      llmGateway,
      generateId,
      listActiveUserIds,
    );

    // Use "today" in JST (UTC+9) since the cron fires at 3 AM JST
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(now.getTime() + jstOffset);
    const dateKey = jstDate.toISOString().slice(0, 10);

    const result = await usecase.execute(dateKey);

    return c.json({
      message: 'Scheduled fermentation completed',
      dateKey,
      ...result,
    });
  });
