import { Hono } from 'hono';
import { z } from 'zod';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntryQuestionLinkRepository } from '../../../question/infrastructure/repositories/supabase-entry-question-link.repository.js';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { COLORS, notifyDiscord } from '../../../shared/infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { rateLimitFermentation } from '../../../shared/presentation/middleware/rate-limit.js';
import { GetFermentationResultUsecase } from '../../application/usecases/get-fermentation-result.usecase.js';
import { GetUserAggregatedReadinessUsecase } from '../../application/usecases/get-user-aggregated-readiness.usecase.js';
import { ListFermentationResultsUsecase } from '../../application/usecases/list-fermentation-results.usecase.js';
import { RunFermentationUsecase } from '../../application/usecases/run-fermentation.usecase.js';
import { SendFermentationDigestUsecase } from '../../application/usecases/send-fermentation-digest.usecase.js';
import { SupabaseUserLocaleResolver } from '../../infrastructure/auth/supabase-user-locale-resolver.js';
import { ResendEmailNotifier } from '../../infrastructure/email/resend-email-notifier.js';
import { createSupabaseVerifiedEmailResolver } from '../../infrastructure/email/supabase-verified-email-resolver.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';
import { SupabaseUserFermentationStateRepository } from '../../infrastructure/repositories/supabase-user-fermentation-state.repository.js';

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

    // issue #279: ユーザーのロケールを解決して LLM プロンプトと digest 文言を切り替える。
    // auth.admin.getUserById は service-role 必須なので getSupabaseClient() を使う。
    const localeResolver = new SupabaseUserLocaleResolver(getSupabaseClient());
    const language = await localeResolver.resolve(c.get('userId'));

    try {
      const result = await usecase.execute({
        userId: c.get('userId'),
        questionId: body.questionId,
        questionText: body.questionText,
        entries: [{ id: body.entryId, content: body.entryContent }],
        language,
      });

      // Send digest email (fire-and-forget). Uses service-role client for auth.admin lookup.
      const digestUsecase = new SendFermentationDigestUsecase(
        new ResendEmailNotifier(),
        createSupabaseVerifiedEmailResolver(getSupabaseClient()),
      );
      digestUsecase
        .execute({ userId: c.get('userId'), questionTitles: [body.questionText], language })
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
  .get('/readiness', async (c) => {
    // issue #278: Jar アニメーション用の集計 readiness を返す。
    // PR #291 以降は問い単位で readiness を持つため、active な問いそれぞれの readiness を
    // 計算し、その合計を発酵瓶全体の readiness として扱う (上限 = 問い数, 現状最大 3.0)。
    // next_eligible_at は意図的に返さない (受け入れ基準: ユーザーには「いつ来るか分からない」体験を維持)。
    const supabase = c.get('supabase');
    const userId = c.get('userId');

    const usecase = new GetUserAggregatedReadinessUsecase(
      new SupabaseQuestionRepository(supabase),
      new SupabaseEntryQuestionLinkRepository(supabase),
      new SupabaseEntryRepository(supabase),
      new SupabaseFermentationRepository(supabase),
      new SupabaseUserFermentationStateRepository(supabase),
      new SupabaseUserLocaleResolver(getSupabaseClient()),
    );

    const readiness = await usecase.execute(userId);
    return c.json(readiness);
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
