import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAuthMiddleware } from '@/contexts/shared/presentation/middleware/admin-auth.js';

// Mock supabase-client module for service-role client
vi.mock('@/contexts/shared/infrastructure/supabase-client.js', () => ({
  getSupabaseClient: vi.fn().mockReturnValue({ from: vi.fn() }),
}));

// Mock @supabase/supabase-js
const mockGetUser = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

function createApp() {
  return new Hono()
    .use('/admin/*', adminAuthMiddleware)
    .get('/admin/test', (c) => c.json({ ok: true }));
}

describe('adminAuthMiddleware', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
  });

  it('returns 401 when no Authorization header', async () => {
    const app = createApp();
    const res = await app.request('/admin/test');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('bad token') });

    const app = createApp();
    const res = await app.request('/admin/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {} } },
      error: null,
    });

    const app = createApp();
    const res = await app.request('/admin/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 when is_admin is false', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: { is_admin: false } } },
      error: null,
    });

    const app = createApp();
    const res = await app.request('/admin/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(403);
  });

  it('passes through when user is admin', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: { is_admin: true } } },
      error: null,
    });

    const app = createApp();
    const res = await app.request('/admin/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
