import { Hono } from 'hono';
import { z } from 'zod';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntryQuestionLinkRepository } from '../../../question/infrastructure/repositories/supabase-entry-question-link.repository.js';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { SupabaseQuestionTransactionRepository } from '../../../question/infrastructure/repositories/supabase-question-transaction.repository.js';
import { COLORS, notifyDiscord } from '../../../shared/infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { rateLimitFermentation } from '../../../shared/presentation/middleware/rate-limit.js';
import { FireFermentationUsecase } from '../../application/usecases/fire-fermentation.usecase.js';
import { FireFirstLetterUsecase } from '../../application/usecases/fire-first-letter.usecase.js';
import { GetFermentationResultUsecase } from '../../application/usecases/get-fermentation-result.usecase.js';
import { GetJarReadinessUsecase } from '../../application/usecases/get-jar-readiness.usecase.js';
import { ListFermentationResultsUsecase } from '../../application/usecases/list-fermentation-results.usecase.js';
import { ListFermentationResultsByUserUsecase } from '../../application/usecases/list-fermentation-results-by-user.usecase.js';
import { MarkLettersReadUsecase } from '../../application/usecases/mark-letters-read.usecase.js';
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

// 既読にする問いの id。RLS が自分の行に絞るので、形だけ確かめれば十分（uuid 以外の id を
// 使うテスト環境も通す）。
const markLettersReadSchema = z.object({
  questionId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
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
  // 手紙を読んだ。問い単位で fermentation_results.read_at を埋める（冪等。ヘルプの五歩 ⑤
  // `hasReadLetter` がこれを読む）。既読の単位が問いなのは受信箱と同じ理由。
  .post('/read', async (c) => {
    const body = markLettersReadSchema.parse(await c.req.json());
    const usecase = new MarkLettersReadUsecase(
      new SupabaseFermentationRepository(c.get('supabase')),
    );
    const result = await usecase.execute({ userId: c.get('userId'), questionId: body.questionId });
    return c.json(result);
  })
  // 初めての漬け込みには、その場で手紙を返す。発酵の行が 1 つも無いユーザーに限り、
  // いちばん最近漬けたエントリの問いへゲートを飛ばして 1 通発火する（2 回目以降は
  // fired=false で何もしないので、client は漬けるたびに呼んでよい）。LLM を同期で回すので
  // `POST /` と同じ枠で回数を絞る。user_fermentation_state は触らず、メールも送らない。
  .post('/first-letter', rateLimitFermentation(), async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    // ロケール解決の auth.admin.getUserById だけ service-role が要る (POST / と同じ理由)。
    const localeResolver = new SupabaseUserLocaleResolver(getSupabaseClient());
    const language = await localeResolver.resolve(userId);

    const entryRepo = new SupabaseEntryRepository(supabase);
    const questionRepo = new SupabaseQuestionRepository(supabase);
    const linkRepo = new SupabaseEntryQuestionLinkRepository(supabase);
    const fermentationRepo = new SupabaseFermentationRepository(supabase);
    const fire = new FireFermentationUsecase(
      entryRepo,
      questionRepo,
      new SupabaseQuestionTransactionRepository(supabase),
      linkRepo,
      fermentationRepo,
      new VercelAiAnalysisGateway(),
      generateId,
    );
    const usecase = new FireFirstLetterUsecase(
      entryRepo,
      questionRepo,
      linkRepo,
      fermentationRepo,
      fire,
    );

    try {
      const result = await usecase.execute({ userId, language });
      return c.json(result, result.fired ? 201 : 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 初回の手紙は体験の入口なので、失敗は Discord に出す (fire-and-forget)。本文は載せない。
      notifyDiscord({
        title: '初回の手紙 — 発酵失敗',
        color: COLORS.ERROR,
        fields: [
          { name: 'User', value: userId.slice(0, 8), inline: true },
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
