import { credentialsSchema } from '@oryzae/shared';
import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { z } from 'zod';

function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env vars not set');
  return createClient(url, anonKey);
}

export const authRoutes = new Hono()
  .post('/signup', async (c) => {
    const body = credentialsSchema.parse(await c.req.json());
    const supabase = getSupabaseAuthClient();

    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
    });

    if (error) {
      return c.json({ error: error.message }, 400);
    }

    return c.json(
      {
        user: { id: data.user?.id, email: data.user?.email },
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
    const body = credentialsSchema.parse(await c.req.json());
    const supabase = getSupabaseAuthClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      return c.json({ error: error.message }, 401);
    }

    return c.json({
      user: { id: data.user.id, email: data.user.email },
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
        accessToken: data.session!.access_token,
        refreshToken: data.session!.refresh_token,
        expiresAt: data.session!.expires_at,
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

    return c.json({
      user: { id: data.user.id, email: data.user.email },
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

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) return c.json({ error: 'Server config error' }, 500);

    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

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

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) return c.json({ error: 'Server config error' }, 500);

    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    return c.json({ user: { id: user.id, email: user.email } });
  });
