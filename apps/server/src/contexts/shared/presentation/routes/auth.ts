import {
  changeEmailSchema,
  changePasswordSchema,
  loginSchema,
  oauthCallbackSchema,
  oauthInitSchema,
  profileUpdateSchema,
  verifyOtpSchema,
} from '@oryzae/shared';
import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../../infrastructure/supabase-client.js';

function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env vars not set');
  return createClient(url, anonKey);
}

function createUserSupabase(authHeader: string) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env vars not set');
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

function getProviders(user: { app_metadata?: Record<string, unknown> }): string[] {
  const providers = user.app_metadata?.providers;
  // @type-assertion-allowed: Supabase types app_metadata values as unknown
  return Array.isArray(providers) ? (providers as string[]) : [];
}

/**
 * URL に query を追加（既存の query は保持）。
 * OAuth リダイレクト URL に locale を埋め込んでクライアントへ伝搬するために使う。
 */
function appendQuery(url: string, key: string, value: string): string {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

export const authRoutes = new Hono()
  // POST /signup と GET /signup-availability は user context (signupRoutes) に切り出し済み
  .post('/login', async (c) => {
    const body = loginSchema.parse(await c.req.json());
    const isEmail = body.identifier.includes('@');

    let email = body.identifier;

    // Resolve nickname to email
    if (!isEmail) {
      const serviceSupabase = getSupabaseClient();
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('id')
        .ilike('nickname', body.identifier)
        .single();

      if (!profile) {
        return c.json({ error: 'ニックネームが見つかりません' }, 401);
      }

      // Get email from auth.users via admin API
      const { data: userData } = await serviceSupabase.auth.admin.getUserById(profile.id);
      if (!userData?.user?.email) {
        return c.json({ error: 'ユーザー情報の取得に失敗しました' }, 401);
      }
      email = userData.user.email;
    }

    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: body.password,
    });

    if (error) {
      return c.json({ error: error.message }, 401);
    }

    // Fetch profile
    const serviceSupabase = getSupabaseClient();
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', data.user.id)
      .single();

    return c.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        nickname: profile?.nickname ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        providers: getProviders(data.user),
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  })
  .post('/refresh', async (c) => {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(await c.req.json());
    const supabase = getSupabaseAuthClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      return c.json({ error: error.message }, 401);
    }

    return c.json({
      session: {
        // @type-assertion-allowed: session is guaranteed non-null after successful refresh
        accessToken: (data.session as NonNullable<typeof data.session>).access_token,
        refreshToken: (data.session as NonNullable<typeof data.session>).refresh_token,
        expiresAt: (data.session as NonNullable<typeof data.session>).expires_at,
      },
    });
  })
  .post('/oauth/google', async (c) => {
    const body = oauthInitSchema.parse(await c.req.json());
    const supabase = getSupabaseAuthClient();

    // OAuth 初期化時点ではユーザー未作成のため、locale は redirectTo に乗せて
    // /oauth/callback で受け取り直し、user_metadata に保存する。
    const redirectTo = body.locale
      ? appendQuery(body.redirectTo, 'locale', body.locale)
      : body.redirectTo;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ url: data.url });
  })
  .post('/oauth/callback', async (c) => {
    const body = oauthCallbackSchema.parse(await c.req.json());
    const { code } = body;
    const supabase = getSupabaseAuthClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Ensure profile exists for OAuth users
    const serviceSupabase = getSupabaseClient();

    // 初回 OAuth サインイン時は user_metadata.locale が未設定。
    // コールバック URL から渡された locale を保存して、以後のメール（change-email 等）が
    // ユーザー言語で送信されるようにする。
    if (body.locale && !data.user.user_metadata?.locale) {
      await serviceSupabase.auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...data.user.user_metadata, locale: body.locale },
      });
    }

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      // Issue #300: Research Preview の登録枠チェック (OAuth 経由の新規ユーザーも対象)
      // shared 層からは user/application 層を import できないため、必要最小限の
      // 件数取得と env 解決をここに inline で書く。policy 本体のテストは
      // apps/server/test/contexts/user/domain/policies/ にある。
      const { count } = await serviceSupabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });
      const rawMax = process.env.MAX_USER_COUNT;
      const parsedMax = rawMax ? Number.parseInt(rawMax, 10) : Number.NaN;
      const limit = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 100;
      if ((count ?? 0) >= limit) {
        // たった今 exchangeCodeForSession で作成された auth.users を削除して整合性を保つ
        await serviceSupabase.auth.admin.deleteUser(data.user.id);
        return c.json({ error: 'capacity_reached', limit }, 409);
      }

      // Auto-create profile for OAuth users
      const meta = data.user.user_metadata ?? {};
      const nickname =
        typeof meta.full_name === 'string'
          ? meta.full_name.replace(/\s+/g, '_').slice(0, 30)
          : `user_${data.user.id.slice(0, 8)}`;
      const avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : null;

      await serviceSupabase.from('profiles').insert({
        id: data.user.id,
        nickname,
        avatar_url: avatarUrl,
      });

      return c.json({
        user: {
          id: data.user.id,
          email: data.user.email,
          nickname,
          avatarUrl,
          providers: getProviders(data.user),
        },
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
        },
      });
    }

    return c.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        nickname: profile.nickname,
        avatarUrl: profile.avatar_url,
        providers: getProviders(data.user),
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  })
  .post('/verify-otp', async (c) => {
    // メールテンプレ内 `{{ .TokenHash }}` を自社ドメイン /auth/confirm に渡し、
    // クライアントから本エンドポイント経由で Supabase の verifyOtp を呼ぶ。
    // これによりメール内リンクが supabase.co を一切経由しなくなり、
    // Microsoft (Outlook) のサイレント破棄を回避する。
    const body = verifyOtpSchema.parse(await c.req.json());
    const supabase = getSupabaseAuthClient();

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: body.tokenHash,
      type: body.type,
    });

    if (error || !data.user || !data.session) {
      return c.json({ error: error?.message ?? 'Verification failed' }, 400);
    }

    const serviceSupabase = getSupabaseClient();
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', data.user.id)
      .single();

    return c.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        nickname: profile?.nickname ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        providers: getProviders(data.user),
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  })
  .post('/reset-password', async (c) => {
    const { email, redirectTo } = z
      .object({ email: z.string().email(), redirectTo: z.string().url() })
      .parse(await c.req.json());
    const supabase = getSupabaseAuthClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ message: 'Password reset email sent' });
  })
  .post('/update-password', async (c) => {
    const { accessToken, password } = z
      .object({ accessToken: z.string(), password: z.string().min(6) })
      .parse(await c.req.json());

    const supabase = createUserSupabase(`Bearer ${accessToken}`);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ message: 'Password updated' });
  })
  .get('/me', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing token' }, 401);
    }

    const supabase = createUserSupabase(authHeader);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Fetch profile
    const serviceSupabase = getSupabaseClient();
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', user.id)
      .single();

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: profile?.nickname ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        providers: getProviders(user),
      },
    });
  })
  .post('/change-password', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing token' }, 401);
    }

    const supabase = createUserSupabase(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = changePasswordSchema.parse(await c.req.json());

    // Verify current password
    const authClient = getSupabaseAuthClient();
    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: user.email,
      password: body.currentPassword,
    });

    if (signInError) {
      return c.json({ error: '現在のパスワードが正しくありません' }, 400);
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: body.newPassword,
    });

    if (updateError) {
      return c.json({ error: updateError.message }, 400);
    }

    return c.json({ message: 'Password updated' });
  })
  .post('/change-email', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing token' }, 401);
    }

    const supabase = createUserSupabase(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = changeEmailSchema.parse(await c.req.json());

    const { error } = await supabase.auth.updateUser({ email: body.newEmail });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json({ message: '確認メールを送信しました' });
  })
  .patch('/profile', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing token' }, 401);
    }

    const supabase = createUserSupabase(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = profileUpdateSchema.parse(await c.req.json());
    const serviceSupabase = getSupabaseClient();

    // Check nickname uniqueness if changing
    if (body.nickname) {
      const { data: existing } = await serviceSupabase
        .from('profiles')
        .select('id')
        .ilike('nickname', body.nickname)
        .neq('id', user.id)
        .single();

      if (existing) {
        return c.json({ error: 'このニックネームは既に使用されています' }, 400);
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.nickname) updateData.nickname = body.nickname;
    if (body.avatarUrl !== undefined) updateData.avatar_url = body.avatarUrl;

    const { error } = await serviceSupabase.from('profiles').update(updateData).eq('id', user.id);

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', user.id)
      .single();

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: profile?.nickname ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      },
    });
  })
  .get('/nickname/check', async (c) => {
    const nickname = c.req.query('nickname');
    if (!nickname) return c.json({ available: false }, 400);

    const serviceSupabase = getSupabaseClient();
    const { data } = await serviceSupabase
      .from('profiles')
      .select('id')
      .ilike('nickname', nickname)
      .single();

    return c.json({ available: !data });
  });
