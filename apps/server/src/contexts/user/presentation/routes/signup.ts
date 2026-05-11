import { type LocaleCode, signupSchema } from '@oryzae/shared';
import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { COLORS, notifyDiscord } from '../../../shared/infrastructure/discord-notify.js';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase-client.js';
import { resolveMaxUserCount } from '../../application/config/signup-cap.js';
import { GetSignupAvailabilityUsecase } from '../../application/usecases/get-signup-availability.usecase.js';
import { SupabaseUserProfileRepository } from '../../infrastructure/repositories/supabase-user-profile.repository.js';

/**
 * サインアップ関連エンドポイント。
 *
 * - `GET /availability` — Research Preview 登録枠の残り (Issue #300)
 * - `POST /` — 新規ユーザー登録（登録枠チェック → Supabase Auth signUp → profile 作成）
 *
 * shared 層は他コンテキストに依存できない (`shared-context-independence`) ため、
 * 旧 `shared/presentation/routes/auth.ts` から user context にこの 2 エンドポイントを
 * 切り出している。
 */

function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env vars not set');
  return createClient(url, anonKey);
}

function getProviders(user: { app_metadata?: Record<string, unknown> }): string[] {
  const providers = user.app_metadata?.providers;
  // @type-assertion-allowed: Supabase types app_metadata values as unknown
  return Array.isArray(providers) ? (providers as string[]) : [];
}

export const signupRoutes = new Hono()
  .get('/availability', async (c) => {
    const serviceSupabase = getSupabaseClient();
    const profileRepo = new SupabaseUserProfileRepository(serviceSupabase);
    const usecase = new GetSignupAvailabilityUsecase(profileRepo, resolveMaxUserCount());
    const availability = await usecase.execute();
    return c.json(availability);
  })
  .post('/', async (c) => {
    const body = signupSchema.parse(await c.req.json());
    const serviceSupabase = getSupabaseClient();
    const profileRepo = new SupabaseUserProfileRepository(serviceSupabase);

    // Issue #300: Research Preview の登録枠チェック（最初に判定して以降の処理を防ぐ）
    const availability = await new GetSignupAvailabilityUsecase(
      profileRepo,
      resolveMaxUserCount(),
    ).execute();
    if (availability.capacityReached) {
      return c.json({ error: 'capacity_reached', limit: availability.limit }, 409);
    }

    // Check nickname uniqueness
    const { data: existing } = await serviceSupabase
      .from('profiles')
      .select('id')
      .ilike('nickname', body.nickname)
      .single();

    if (existing) {
      return c.json({ error: 'このニックネームは既に使用されています' }, 400);
    }

    // Create auth user.
    // locale は Supabase 確認メールテンプレートの `{{ .Data.locale }}` で参照される。
    const supabase = getSupabaseAuthClient();
    const locale: LocaleCode = body.locale ?? 'ja';
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { locale },
      },
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Create profile
    if (data.user) {
      await serviceSupabase.from('profiles').insert({
        id: data.user.id,
        nickname: body.nickname,
      });

      // Notify Discord (fire-and-forget)
      notifyDiscord({
        title: '新規ユーザー登録',
        color: COLORS.SUCCESS,
        fields: [
          { name: 'ニックネーム', value: body.nickname, inline: true },
          { name: 'メール', value: body.email, inline: true },
        ],
      });
    }

    return c.json(
      {
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email,
              nickname: body.nickname,
              avatarUrl: null,
              providers: getProviders(data.user),
            }
          : null,
        session: data.session
          ? {
              accessToken: data.session.access_token,
              refreshToken: data.session.refresh_token,
              expiresAt: data.session.expires_at,
            }
          : null,
      },
      201,
    );
  });
