import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tryRefreshToken } from '@/lib/api';

/**
 * Issue #362: layout の mount-gate でトークン直読のデータフックが検証前に走るため、
 * 失効トークンで複数リクエストが同時に 401 → 並発 refresh になりうる。
 * tryRefreshToken の in-flight シングルトンがそれを1回に集約することを検証する。
 */
describe('tryRefreshToken (admin, Issue #362: in-flight singleton)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function okSession(accessToken: string, refreshToken: string): Response {
    return {
      ok: true,
      json: () => Promise.resolve({ session: { accessToken, refreshToken } }),
    } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
  }

  it('並発呼び出しは refresh リクエストを1回に集約し、同じトークンを返す', async () => {
    localStorage.setItem('oryzae_admin_refresh_token', 'rt-1');
    let resolveFetch: ((r: Response) => void) | undefined;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => new Promise<Response>((res) => (resolveFetch = res)));

    const p1 = tryRefreshToken();
    const p2 = tryRefreshToken();
    resolveFetch?.(okSession('at-2', 'rt-2'));
    const [t1, t2] = await Promise.all([p1, p2]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(t1).toBe('at-2');
    expect(t2).toBe('at-2');
    expect(localStorage.getItem('oryzae_admin_access_token')).toBe('at-2');
  });

  it('refresh token が無ければ null を返し、refresh リクエストもしない', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await tryRefreshToken();
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
