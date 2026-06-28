import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tryRefreshToken } from '@/lib/api';

/**
 * Issue #362: 楽観的データ取得では失効トークンで複数リクエストが同時に 401 になり、
 * 並発リフレッシュ（refresh token ローテーションによる二重実行）が起きうる。
 * tryRefreshToken の in-flight シングルトンがそれを1本に集約することを検証する。
 */
describe('tryRefreshToken (Issue #362: in-flight singleton)', () => {
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
    } as Response;
  }

  it('並発呼び出しは refresh リクエストを1回に集約し、同じトークンを返す', async () => {
    localStorage.setItem('oryzae_refresh_token', 'rt-1');
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
    expect(localStorage.getItem('oryzae_access_token')).toBe('at-2');
  });

  it('解決後の呼び出しは再度 refresh する（シングルトンはクリアされる）', async () => {
    localStorage.setItem('oryzae_refresh_token', 'rt-1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okSession('at-x', 'rt-x'));

    await tryRefreshToken();
    await tryRefreshToken();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('refresh token が無ければ null を返し、refresh リクエストもしない', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await tryRefreshToken();

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
