import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateAuthUser } from '@/contexts/shared/infrastructure/supabase-auth-user.js';

const mockFetch = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('updateAuthUser', () => {
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

  it("sends PUT /auth/v1/user with the user's own JWT (not the service role)", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'user-1' }));

    const result = await updateAuthUser('user-jwt', { password: 'new-password' });

    expect(result).toEqual({ error: null });
    const [url, init] = mockFetch.mock.calls[0] ?? [];
    expect(url).toBe('https://example.supabase.co/auth/v1/user');
    expect(init.method).toBe('PUT');
    expect(init.headers).toMatchObject({ apikey: 'anon-key', Authorization: 'Bearer user-jwt' });
    expect(JSON.parse(init.body)).toEqual({ password: 'new-password' });
  });

  it('returns the Supabase message so the client can translate it', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          code: 422,
          error_code: 'same_password',
          msg: 'New password should be different from the old password.',
        },
        422,
      ),
    );

    const result = await updateAuthUser('user-jwt', { password: 'same' });

    expect(result.error).toBe('New password should be different from the old password.');
  });

  it('falls back to the HTTP status when the body has no message', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null, 500));

    const result = await updateAuthUser('user-jwt', { email: 'a@example.com' });

    expect(result.error).toBe('Auth request failed (HTTP 500)');
  });
});
