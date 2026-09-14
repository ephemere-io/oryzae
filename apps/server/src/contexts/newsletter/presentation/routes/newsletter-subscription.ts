import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { SetNewsletterSubscriptionUsecase } from '../../application/usecases/set-newsletter-subscription.usecase.js';
import { SupabaseNewsletterSubscriptionRepository } from '../../infrastructure/repositories/supabase-newsletter-subscription.repository.js';
import { HmacUnsubscribeToken } from '../../infrastructure/unsubscribe/hmac-unsubscribe-token.js';

/**
 * 配信停止 / 再開（**ログイン不要**）。
 *
 * ## なぜ認証を挟まないか
 *
 * 配信停止をするのは「もう読みたくない」人で、その人はログインしない。
 * ログインを要求すると実質「止められない」に等しくなり、迷惑メール報告のほうが
 * 早くなる。本人性は HMAC 署名済みトークン（`HmacUnsubscribeToken`）だけで担保し、
 * **user_id をリクエストから受け取らない**。
 *
 * ## なぜ service role を使うか
 *
 * ユーザー JWT が存在しないので RLS を認可境界にできない。代わりに、書き込み先の
 * 行を決めるのは検証済みトークンから取り出した user_id だけで、リクエスト本文の
 * 値をクエリ条件に渡す経路は無い。更新するのは `profiles.newsletter_opt_out`
 * 1 列のみ。
 *
 * ## なぜ POST だけか
 *
 * GET で状態を変えると、メールクライアントやセキュリティスキャナの
 * リンク先読み（Outlook SafeLinks 等）で勝手に配信停止になる。RFC 8058 も
 * ワンクリック配信停止を POST と定めている。
 */
type Env = Record<string, never>;

const tokenSchema = z.object({ token: z.string().min(1) });

/**
 * トークンの取り出し。
 *
 * - クエリ `?token=` — RFC 8058 のワンクリック（メール提供元が
 *   `List-Unsubscribe=One-Click` を form-encoded で POST してくる。本文に
 *   トークンは載らないので URL 側で受ける）
 * - JSON 本文 `{ token }` — 配信停止ページからの呼び出し
 */
async function readToken(c: {
  req: { query: (k: string) => string | undefined; json: () => Promise<unknown> };
}): Promise<string | null> {
  const fromQuery = c.req.query('token');
  if (fromQuery) return fromQuery;

  try {
    const parsed = tokenSchema.safeParse(await c.req.json());
    return parsed.success ? parsed.data.token : null;
  } catch {
    // form-encoded (RFC 8058) は JSON として読めない。クエリに無ければ諦める。
    return null;
  }
}

function createUsecase(): SetNewsletterSubscriptionUsecase {
  return new SetNewsletterSubscriptionUsecase(
    new HmacUnsubscribeToken(),
    new SupabaseNewsletterSubscriptionRepository(getSupabaseClient()),
  );
}

export const newsletterSubscription = new Hono<Env>()
  .post('/unsubscribe', async (c) => {
    const token = await readToken(c);
    if (!token) return c.json({ error: 'Missing token' }, 400);

    const result = await createUsecase().execute({ token, optOut: true });
    return c.json(result);
  })
  // 配信停止ページの「やっぱり受け取る」。同じトークンで戻せるようにしてあるのは、
  // 押し間違い（やスキャナによる誤作動）からログインなしで復帰できるようにするため。
  .post('/resubscribe', async (c) => {
    const token = await readToken(c);
    if (!token) return c.json({ error: 'Missing token' }, 400);

    const result = await createUsecase().execute({ token, optOut: false });
    return c.json(result);
  });
