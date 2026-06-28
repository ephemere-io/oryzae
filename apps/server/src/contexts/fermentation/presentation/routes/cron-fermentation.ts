import { Hono } from 'hono';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntryQuestionLinkRepository } from '../../../question/infrastructure/repositories/supabase-entry-question-link.repository.js';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { SupabaseQuestionTransactionRepository } from '../../../question/infrastructure/repositories/supabase-question-transaction.repository.js';
import { COLORS, notifyDiscord } from '../../../shared/infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { createCronAuthMiddleware } from '../../../shared/presentation/middleware/cron-auth.js';
import {
  type RetryFailedFermentationsResult,
  RetryFailedFermentationsUsecase,
} from '../../application/usecases/retry-failed-fermentations.usecase.js';
import { ScheduledFermentationUsecase } from '../../application/usecases/scheduled-fermentation.usecase.js';
import { SendFermentationDigestUsecase } from '../../application/usecases/send-fermentation-digest.usecase.js';
import { SupabaseUserLocaleResolver } from '../../infrastructure/auth/supabase-user-locale-resolver.js';
import { ResendEmailNotifier } from '../../infrastructure/email/resend-email-notifier.js';
import { createSupabaseVerifiedEmailResolver } from '../../infrastructure/email/supabase-verified-email-resolver.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';
import { SupabaseUserFermentationStateRepository } from '../../infrastructure/repositories/supabase-user-fermentation-state.repository.js';
import { summarizeFailureReasons } from '../summarize-failure-reasons.js';

const generateId = () => crypto.randomUUID();

export const cronFermentation = new Hono()
  .use(
    '*',
    createCronAuthMiddleware({
      routeName: 'cron-fermentation',
      discordTitlePrefix: '発酵 cron',
    }),
  )
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
      (userId, titles, language) =>
        digestUsecase.execute({ userId, questionTitles: titles, language }),
      // 失敗の瞬間に即通知。末尾の summary は処理が重く Vercel に kill されると
      // 出ないことがあるため、失敗を取りこぼさない経路を別に持つ (dedup + 上限は
      // usecase 側で管理)。
      async (reason, sample) => {
        await notifyDiscord({
          title: '発酵 cron: 失敗発生',
          color: COLORS.ERROR,
          fields: [
            { name: 'User', value: sample.userId.slice(0, 8), inline: true },
            { name: 'Question', value: sample.questionId.slice(0, 8), inline: true },
            { name: '理由', value: reason.slice(0, 1000) || '(理由不明)' },
          ],
        });
      },
    );

    // issue #353: sweep 後に「前回 cron で完了しなかった発酵」を1回だけリトライする。
    const retryUsecase = new RetryFailedFermentationsUsecase(
      fermentationRepo,
      entryRepo,
      questionTransactionRepo,
      localeResolver,
      llmGateway,
      generateId,
      (userId, titles, language) =>
        digestUsecase.execute({ userId, questionTitles: titles, language }),
    );

    // issue #268 以降、発火条件はユーザー単位の状態 (lastRunAt + 文字数 + ランダム X 時間)
    // で決まるため、cron は「現時刻」を渡すだけで良い (旧来の dateKey は不要)。
    // issue #353: sweep とリトライで同じ now を共有する。リトライの「今 run 除外」窓
    // (beforeIso=now) が sweep 後にずれて自分の失敗を拾わないようにするため。
    const now = new Date();
    try {
      const result = await usecase.execute(now);

      // sweep 直後に未完了分をリトライ。リトライ段の失敗は sweep の結果を握り潰さない
      // よう個別に握り、summary に retryError として添える。
      let retry: RetryFailedFermentationsResult | null = null;
      let retryError: string | null = null;
      try {
        retry = await retryUsecase.execute(now);
      } catch (error) {
        retryError = error instanceof Error ? error.message : 'Unknown error';
        console.error('[cron-fermentation] retry phase failed', { error: retryError });
      }

      // 発酵そのものの失敗 (LLM エラー等) は ERROR、メール送信失敗だけなら WARNING。
      // 「failed: N」だけでは原因が分からず retire 障害が 12 日埋もれたため、
      // errors を集約した「失敗理由」を必ず添える (summarizeFailureReasons で
      // 同一理由を畳み、Discord の field 上限内に収める)。
      // issue #353: リトライ段の失敗・取りこぼし(truncated)・retryError も失敗扱いに含める。
      // skipped は「ユーザーがエントリ/問いを消した」等の良性ケースなので色付けには含めない
      // （含めると削除があっただけで「一部失敗」アラートが鳴る）。件数は summary には出す。
      const retryHasFailures =
        retry !== null && (retry.failed > 0 || retry.errors.length > 0 || retry.truncated > 0);
      const hasFermentationFailures =
        result.failed > 0 ||
        result.errors.length > 0 ||
        retryError !== null ||
        (retry !== null && (retry.failed > 0 || retry.errors.length > 0));
      const hasFailures =
        hasFermentationFailures ||
        result.emailFailures.length > 0 ||
        retryHasFailures ||
        (retry !== null && retry.emailFailures.length > 0);

      const fields = [
        { name: 'totalUsers', value: String(result.totalUsers), inline: true },
        { name: 'eligibleUsers', value: String(result.eligibleUsers), inline: true },
        { name: 'totalFermentations', value: String(result.totalFermentations), inline: true },
        { name: 'succeeded', value: String(result.succeeded), inline: true },
        { name: 'failed', value: String(result.failed), inline: true },
        { name: 'emailFailures', value: String(result.emailFailures.length), inline: true },
      ];

      const failureReasons = summarizeFailureReasons(result.errors);
      if (failureReasons) {
        fields.push({ name: '失敗理由', value: failureReasons, inline: false });
      }

      // issue #353: リトライ段の結果を summary に添える。候補が無い日はノイズになるので
      // 候補があった日 or retryError があった日のみ出す。
      if (retry !== null && retry.totalCandidates > 0) {
        fields.push({
          name: 'リトライ',
          value: `候補:${retry.totalCandidates} 成功:${retry.succeeded} 失敗:${retry.failed} skip:${retry.skipped} 打切:${retry.truncated}`,
          inline: false,
        });
        const retryFailureReasons = summarizeFailureReasons(retry.errors);
        if (retryFailureReasons) {
          fields.push({ name: 'リトライ失敗理由', value: retryFailureReasons, inline: false });
        }
      }
      if (retryError) {
        fields.push({
          name: 'リトライ実行エラー',
          value: retryError.slice(0, 1000),
          inline: false,
        });
      }

      await notifyDiscord({
        title: hasFailures ? '発酵 cron: 完了（一部失敗）' : '発酵 cron: 完了',
        color: hasFermentationFailures
          ? COLORS.ERROR
          : hasFailures
            ? COLORS.WARNING
            : COLORS.SUCCESS,
        fields,
      });

      return c.json({
        message: 'Scheduled fermentation completed',
        ...result,
        retry: retry ?? undefined,
        retryError: retryError ?? undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[cron-fermentation] execution failed', { error: message });
      await notifyDiscord({
        title: '発酵 cron: 実行中にエラー',
        description: message,
        color: COLORS.ERROR,
      });
      return c.json({ error: 'Internal Server Error', message }, 500);
    }
  });
