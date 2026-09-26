import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authRoutes } from '@/contexts/shared/presentation/routes/auth.js';

const mockFetch = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// パスワード再設定リンクから来たユーザーは、URL から取り出したアクセストークンしか持たない。
// 以前は supabase.auth.updateUser() を使っていて、ヘッダーだけのクライアントでは必ず
// "Auth session missing!" になり、画面に「セッションが切れました」が出て再設定できなかった。
describe('POST /update-password', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('updates the password with only the recovery access token', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'user-1' }));

    const res = await authRoutes.request('/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'recovery-jwt', password: 'new-password' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Password updated' });
    const [url, init] = mockFetch.mock.calls[0] ?? [];
    expect(url).toBe('https://example.supabase.co/auth/v1/user');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer recovery-jwt' });
  });

  it('passes the Supabase error through as 400', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ msg: 'New password should be different from the old password.' }, 422),
    );

    const res = await authRoutes.request('/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: 'recovery-jwt', password: 'same-password' }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'New password should be different from the old password.',
    });
  });
});
