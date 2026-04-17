import { loginSchema, profileUpdateSchema, signupSchema } from '@oryzae/shared';
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

export const authRoutes = new Hono()
  .post('/signup', async (c) => {
    const body = signupSchema.parse(await c.req.json());
    const serviceSupabase = getSupabaseClient();

    // Check nickname uniqueness
    const { data: existing } = await serviceSupabase
      .from('profiles')
      .select('id')
      .ilike('nickname', body.nickname)
      .single();

    if (existing) {
      return c.json({ error: 'このニックネームは既に使用されています' }, 400);
    }

    // Create auth user
    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
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
    }

    return c.json(
      {
        user: data.user
          ? { id: data.user.id, email: data.user.email, nickname: body.nickname, avatarUrl: null }
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
  })
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
    const { redirectTo } = z.object({ redirectTo: z.string().url() }).parse(await c.req.json());
    const supabase = getSupabaseAuthClient();

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
    const { code } = z.object({ code: z.string() }).parse(await c.req.json());
    const supabase = getSupabaseAuthClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    // Ensure profile exists for OAuth users
    const serviceSupabase = getSupabaseClient();
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
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
        user: { id: data.user.id, email: data.user.email, nickname, avatarUrl },
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
      },
    });
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
