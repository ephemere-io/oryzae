import { Hono } from 'hono';
import { z } from 'zod';
import { COLORS, notifyDiscord } from '../../../shared/infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { rateLimitFermentation } from '../../../shared/presentation/middleware/rate-limit.js';
import { GetFermentationResultUsecase } from '../../application/usecases/get-fermentation-result.usecase.js';
import { ListFermentationResultsUsecase } from '../../application/usecases/list-fermentation-results.usecase.js';
import { RunFermentationUsecase } from '../../application/usecases/run-fermentation.usecase.js';
import { SendFermentationDigestUsecase } from '../../application/usecases/send-fermentation-digest.usecase.js';
import { ResendEmailNotifier } from '../../infrastructure/email/resend-email-notifier.js';
import { createSupabaseVerifiedEmailResolver } from '../../infrastructure/email/supabase-verified-email-resolver.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const runFermentationSchema = z.object({
  entryId: z.string().uuid(),
  questionId: z.string().uuid(),
  questionText: z.string().min(1),
  entryContent: z.string().min(1),
});

const generateId = () => crypto.randomUUID();

export const fermentations = new Hono<Env>()
  .post('/', rateLimitFermentation(), async (c) => {
    const body = runFermentationSchema.parse(await c.req.json());
    const supabase = c.get('supabase');
    const repo = new SupabaseFermentationRepository(supabase);
    const llmGateway = new VercelAiAnalysisGateway();
    const usecase = new RunFermentationUsecase(repo, llmGateway, generateId);

    try {
      const result = await usecase.execute({
        userId: c.get('userId'),
        questionId: body.questionId,
        questionText: body.questionText,
        entries: [{ id: body.entryId, content: body.entryContent }],
      });

      // Send digest email (fire-and-forget). Uses service-role client for auth.admin lookup.
      const digestUsecase = new SendFermentationDigestUsecase(
        new ResendEmailNotifier(),
        createSupabaseVerifiedEmailResolver(getSupabaseClient()),
      );
      digestUsecase
        .execute({ userId: c.get('userId'), questionTitles: [body.questionText] })
        .catch(() => {
          // Notification failure must not break the API response.
        });

      return c.json(result, 201);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Notify Discord about fermentation failure (fire-and-forget)
      notifyDiscord({
        title: '発酵プロセス失敗',
        color: COLORS.ERROR,
        fields: [
          { name: 'User', value: c.get('userId').slice(0, 8), inline: true },
          { name: 'Question', value: body.questionId.slice(0, 8), inline: true },
          { name: 'Error', value: errorMessage.slice(0, 200) },
        ],
      });

      throw error;
    }
  })
  .get('/', async (c) => {
    const questionId = c.req.query('questionId');
    if (!questionId) return c.json({ error: 'questionId is required' }, 400);

    const supabase = c.get('supabase');
    const repo = new SupabaseFermentationRepository(supabase);
    const usecase = new ListFermentationResultsUsecase(repo);

    const results = await usecase.execute(questionId);
    return c.json(results);
  })
  .get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const repo = new SupabaseFermentationRepository(supabase);
    const usecase = new GetFermentationResultUsecase(repo);

    const detail = await usecase.execute(c.req.param('id'));
    return c.json({
      ...detail.result.toProps(),
      worksheet: detail.worksheet?.toProps() ?? null,
      snippets: detail.snippets.map((s) => s.toProps()),
      letter: detail.letter?.toProps() ?? null,
      keywords: detail.keywords.map((k) => k.toProps()),
    });
  });
