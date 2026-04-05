import { createClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { z } from 'zod';

const authRoutes = new Hono();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function getSupabaseAuthClient() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Supabase env vars not set');
  return createClient(url, anonKey);
}

// POST /auth/signup
authRoutes.post('/signup', async (c) => {
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
});

// POST /auth/login
authRoutes.post('/login', async (c) => {
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
});

// POST /auth/refresh
authRoutes.post('/refresh', async (c) => {
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
});

// GET /auth/me
authRoutes.get('/me', async (c) => {
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

export { authRoutes };
