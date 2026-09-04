import { Hono } from 'hono';
import { z } from 'zod';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { COLORS, notifyDiscord } from '../../../shared/infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { rateLimitFermentation } from '../../../shared/presentation/middleware/rate-limit.js';
import { GetFermentationReadinessUsecase } from '../../application/usecases/get-fermentation-readiness.usecase.js';
import { GetFermentationResultUsecase } from '../../application/usecases/get-fermentation-result.usecase.js';
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

/**
 * 本人に見せる発酵の進み具合。
 *
 * admin 版（GET /admin/fermentations/readiness/:userId）は threshold / charsCurrent /
 * hoursElapsed まで返すが、本人向けはこの 3 つに絞る。書斎の瓶は readiness を数値では
 * 出さない（進み具合は見た目が語る）ので UI に要らないうえ、発火閾値そのものを
 * 晒さずに済む。
 */
export interface OwnerReadinessView {
  /** 0..1。小数第2位まで（= 永続化カラム numeric(3,2) と同じ粒度）。 */
  readiness: number;
  /** 文字数・経過時間の両方を満たしていて、次の cron で発火しうるか。 */
  eligible: boolean;
  /** 次に発火しうる時刻。未発酵（時間ゲートが無い）なら null。 */
  nextRunAt: string | null;
}

/**
 * usecase の評価結果を本人向けの形に落とす。
 *
 * readiness を丸めるのは見た目のためではなく、`charScore = 文字数 / 閾値` の生の浮動小数が
 * **書いた文字数をほぼそのまま逆算できる**ため。永続化カラムと同じ小数第2位に揃えて、
 * API から出る粒度を DB に載っている粒度より細かくしない。
 */
export function toOwnerReadinessView(evaluation: {
  readinessScore: number;
  eligible: boolean;
  nextEligibleAt: string | null;
}): OwnerReadinessView {
  return {
    readiness: Math.round(evaluation.readinessScore * 100) / 100,
    eligible: evaluation.eligible,
    nextRunAt: evaluation.nextEligibleAt,
  };
}

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
  // 書斎の瓶（docs/oryzae-study）が読む進み具合。admin と同じ評価ロジックを本人向けに開く。
  //
  // **`/:id` より前に置くこと。** Hono は登録順に照合するので、後ろに置くと
  // id="readiness" の詳細取得として食われる。
  .get('/readiness', async (c) => {
    const supabase = c.get('supabase');
    const usecase = new GetFermentationReadinessUsecase(
      // entries も user_fermentation_state も own-data の RLS があるため、
      // 本人の JWT で作ったクライアントで足りる（service role は要らない）。
      new SupabaseEntryRepository(supabase),
      new SupabaseUserFermentationStateRepository(supabase),
      // ロケール解決だけは auth.admin.getUserById ＝ service role が要る。
      // このファイルは dep-cruise の service-role-client-containment 許可リスト内。
      new SupabaseUserLocaleResolver(getSupabaseClient()),
    );

    const evaluation = await usecase.execute(c.get('userId'));
    return c.json(toOwnerReadinessView(evaluation));
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
