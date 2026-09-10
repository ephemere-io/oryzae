import { Hono } from 'hono';
import { z } from 'zod';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { COLORS, notifyDiscord } from '../../../shared/infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { rateLimitFermentation } from '../../../shared/presentation/middleware/rate-limit.js';
import { GetFermentationResultUsecase } from '../../application/usecases/get-fermentation-result.usecase.js';
import { GetJarReadinessUsecase } from '../../application/usecases/get-jar-readiness.usecase.js';
import { ListFermentationResultsUsecase } from '../../application/usecases/list-fermentation-results.usecase.js';
import { ListFermentationResultsByUserUsecase } from '../../application/usecases/list-fermentation-results-by-user.usecase.js';
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
    const supabase = c.get('supabase');
    const repo = new SupabaseFermentationRepository(supabase);

    // issue #363 perf: questionId 省略時はユーザーの全発酵結果を1回で返す（瓶の未読バッジ・
    // 受信箱の N+1 を解消）。questionId 指定時は従来どおり問い単位で返す。
    const questionId = c.req.query('questionId');
    if (!questionId) {
      const usecase = new ListFermentationResultsByUserUsecase(repo);
      const results = await usecase.execute(c.get('userId'));
      return c.json(results);
    }

    const usecase = new ListFermentationResultsUsecase(repo);
    const results = await usecase.execute(questionId);
    return c.json(results);
  })
  // issue #278: 瓶アニメーション用の readiness。**`/:id` より前に置くこと**
  // (Hono は登録順に照合するので、後ろに置くと `/readiness` が id 扱いになる)。
  .get('/readiness', async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    // ロケール解決の auth.admin.getUserById だけ service-role が要る (POST / と同じ理由)。
    const localeResolver = new SupabaseUserLocaleResolver(getSupabaseClient());
    const usecase = new GetJarReadinessUsecase(
      new SupabaseQuestionRepository(supabase),
      new SupabaseEntryRepository(supabase),
      new SupabaseFermentationRepository(supabase),
      new SupabaseUserFermentationStateRepository(supabase),
      localeResolver,
    );

    // cron が日次で書く user_fermentation_state.readiness_score ではなく、その場で
    // 評価し直す。エントリを書いた直後に瓶が反応してほしいため (issue #278 受け入れ基準)。
    return c.json(await usecase.execute(userId));
  })
  .get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const repo = new SupabaseFermentationRepository(supabase);
    const usecase = new GetFermentationResultUsecase(repo, new SupabaseEntryRepository(supabase));

    const detail = await usecase.execute(c.req.param('id'));
    return c.json({
      ...detail.result.toProps(),
      worksheet: detail.worksheet?.toProps() ?? null,
      snippets: detail.snippets.map((s) => s.toProps()),
      letter: detail.letter?.toProps() ?? null,
      keywords: detail.keywords.map((k) => k.toProps()),
      // Issue #453: 手紙だけでは「何に対する返事か」が分からないので、もとの記録を添える。
      scannedEntries: detail.scannedEntries,
    });
  });
