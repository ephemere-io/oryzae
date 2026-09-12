import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { z } from 'zod';
import { NewsletterChangelogUnavailableError } from '../../application/errors/newsletter.errors.js';
import { CreateNewsletterUsecase } from '../../application/usecases/create-newsletter.usecase.js';
import { DeleteNewsletterUsecase } from '../../application/usecases/delete-newsletter.usecase.js';
import { GenerateNewsletterDraftUsecase } from '../../application/usecases/generate-newsletter-draft.usecase.js';
import { GetNewsletterUsecase } from '../../application/usecases/get-newsletter.usecase.js';
import { ListNewslettersUsecase } from '../../application/usecases/list-newsletters.usecase.js';
import { PreviewNewsletterUsecase } from '../../application/usecases/preview-newsletter.usecase.js';
import { SendNewsletterUsecase } from '../../application/usecases/send-newsletter.usecase.js';
import { UpdateNewsletterUsecase } from '../../application/usecases/update-newsletter.usecase.js';
import {
  MAX_NEWSLETTER_BODY_LENGTH,
  MAX_NEWSLETTER_SUBJECT_LENGTH,
} from '../../domain/models/newsletter.js';
import { SupabaseNewsletterAudience } from '../../infrastructure/audience/supabase-newsletter-audience.js';
import { ResendBulkEmailSender } from '../../infrastructure/email/resend-bulk-email-sender.js';
import {
  GithubChangelogSource,
  GithubChangelogUnavailableError,
} from '../../infrastructure/github/github-changelog-source.js';
import { VercelAiNewsletterDraftGateway } from '../../infrastructure/llm/vercel-ai-newsletter-draft.gateway.js';
import { SupabaseNewsletterRepository } from '../../infrastructure/repositories/supabase-newsletter.repository.js';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

const contentSchema = z.object({
  subject: z.string().min(1).max(MAX_NEWSLETTER_SUBJECT_LENGTH),
  bodyMarkdown: z.string().min(1).max(MAX_NEWSLETTER_BODY_LENGTH),
});

/**
 * 送信は「確認した」ことを本文で明示させる (issue #614 の制約)。
 *
 * 画面側の 2 段階クリックだけに頼ると、URL を直接叩いた / 画面を差し替えた
 * ときに黙って全員へ送れてしまう。**確認は API の契約として持つ。**
 */
const sendSchema = z.object({ confirm: z.literal(true) });

export const adminNewsletters = new Hono<Env>()
  .get('/', async (c) => {
    const usecase = new ListNewslettersUsecase(
      new SupabaseNewsletterRepository(c.get('adminSupabase')),
    );
    return c.json({ data: await usecase.execute() });
  })
  .post('/', async (c) => {
    const body = contentSchema.parse(await c.req.json());
    const usecase = new CreateNewsletterUsecase(
      new SupabaseNewsletterRepository(c.get('adminSupabase')),
      () => crypto.randomUUID(),
    );
    const created = await usecase.execute({ ...body, createdBy: c.get('adminUserId') });
    return c.json({ data: created }, 201);
  })
  // `/:id` 系より前に置く。いまは POST /:id が無いので実害は無いが、
  // 後から足したときに黙って横取りされないようにする。
  .post('/generate-draft', async (c) => {
    const supabase = c.get('adminSupabase');
    const usecase = new GenerateNewsletterDraftUsecase(
      new SupabaseNewsletterRepository(supabase),
      new GithubChangelogSource(),
      new VercelAiNewsletterDraftGateway(),
      () => crypto.randomUUID(),
    );

    try {
      return c.json(await usecase.execute({ createdBy: c.get('adminUserId') }), 201);
    } catch (error) {
      // GitHub 側の設定漏れ / 障害は「サーバーが壊れた」ではなく「今は素材が
      // 取れない」。理由をそのまま画面に出せるよう 400 に寄せる。
      if (error instanceof GithubChangelogUnavailableError) {
        throw new NewsletterChangelogUnavailableError(error.message);
      }
      throw error;
    }
  })
  .get('/:id', async (c) => {
    const usecase = new GetNewsletterUsecase(
      new SupabaseNewsletterRepository(c.get('adminSupabase')),
    );
    return c.json({ data: await usecase.execute(c.req.param('id')) });
  })
  .put('/:id', async (c) => {
    const body = contentSchema.parse(await c.req.json());
    const usecase = new UpdateNewsletterUsecase(
      new SupabaseNewsletterRepository(c.get('adminSupabase')),
    );
    return c.json({ data: await usecase.execute({ id: c.req.param('id'), ...body }) });
  })
  .delete('/:id', async (c) => {
    const usecase = new DeleteNewsletterUsecase(
      new SupabaseNewsletterRepository(c.get('adminSupabase')),
    );
    await usecase.execute(c.req.param('id'));
    return c.json({ data: { id: c.req.param('id') } });
  })
  // 送信前の確認材料（HTML プレビュー・宛先数）。
  .get('/:id/preview', async (c) => {
    const supabase = c.get('adminSupabase');
    const usecase = new PreviewNewsletterUsecase(
      new SupabaseNewsletterRepository(supabase),
      new SupabaseNewsletterAudience(supabase),
    );
    return c.json({ data: await usecase.execute(c.req.param('id')) });
  })
  .post('/:id/send', async (c) => {
    sendSchema.parse(await c.req.json());

    const supabase = c.get('adminSupabase');
    const usecase = new SendNewsletterUsecase(
      new SupabaseNewsletterRepository(supabase),
      new SupabaseNewsletterAudience(supabase),
      new ResendBulkEmailSender(),
    );

    const result = await usecase.execute(c.req.param('id'));
    // 本文・宛先は載せない。件数と結果だけ残す。
    console.info('[admin-newsletters] send finished', {
      newsletterId: result.newsletter.id,
      sent: result.sent,
      delivered: result.delivered,
      failed: result.failed,
    });
    return c.json({ data: result });
  });
