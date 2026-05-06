import { Hono } from 'hono';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntryQuestionLinkRepository } from '../../../question/infrastructure/repositories/supabase-entry-question-link.repository.js';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { SupabaseQuestionTransactionRepository } from '../../../question/infrastructure/repositories/supabase-question-transaction.repository.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { ScheduledFermentationUsecase } from '../../application/usecases/scheduled-fermentation.usecase.js';
import { SendFermentationDigestUsecase } from '../../application/usecases/send-fermentation-digest.usecase.js';
import { SupabaseUserLocaleResolver } from '../../infrastructure/auth/supabase-user-locale-resolver.js';
import { ResendEmailNotifier } from '../../infrastructure/email/resend-email-notifier.js';
import { createSupabaseVerifiedEmailResolver } from '../../infrastructure/email/supabase-verified-email-resolver.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';
import { SupabaseUserFermentationStateRepository } from '../../infrastructure/repositories/supabase-user-fermentation-state.repository.js';

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
    const userStateRepo = new SupabaseUserFermentationStateRepository(supabase);
    const localeResolver = new SupabaseUserLocaleResolver(supabase);
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

    const digestUsecase = new SendFermentationDigestUsecase(
      new ResendEmailNotifier(),
      createSupabaseVerifiedEmailResolver(supabase),
    );

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      questionTransactionRepo,
      entryQuestionLinkRepo,
      fermentationRepo,
      userStateRepo,
      localeResolver,
      llmGateway,
      generateId,
      listActiveUserIds,
      (userId, titles) => digestUsecase.execute({ userId, questionTitles: titles }),
    );

    // issue #268 以降、発火条件はユーザー単位の状態 (lastRunAt + 文字数 + ランダム X 時間)
    // で決まるため、cron は「現時刻」を渡すだけで良い (旧来の dateKey は不要)。
    const result = await usecase.execute(new Date());

    return c.json({
      message: 'Scheduled fermentation completed',
      ...result,
    });
  });
