import { createClient } from '@supabase/supabase-js';
import type { Context, Next } from 'hono';
import { getSupabaseClient } from '../../infrastructure/supabase-client.js';

export async function adminAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return c.json({ error: 'Server configuration error' }, 500);
  }

  const userSupabase = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const {
    data: { user },
    error,
  } = await userSupabase.auth.getUser();

  if (error || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const isAdmin = user.user_metadata?.is_admin === true;
  if (!isAdmin) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  c.set('adminUserId', user.id);
  c.set('adminSupabase', getSupabaseClient());

  const mod = '@sentry/nextjs';
  import(/* webpackIgnore: true */ mod)
    .then((Sentry: { setUser: (user: { id: string }) => void }) => {
      Sentry.setUser({ id: user.id });
    })
    .catch(() => {});

  await next();
}
