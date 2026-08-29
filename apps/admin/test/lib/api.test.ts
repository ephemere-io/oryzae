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

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function okSession(accessToken: string, refreshToken: string): Response {
    return jsonResponse({ session: { accessToken, refreshToken } });
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

  // 以下2件は「200 だが body が壊れている」と「401」の扱いを分けたことを固定する。
  // `null` を返す点は旧実装も同じなので、**refresh token が残るかどうか**を assert
  // しないと退行を検出できない。

  it('200 でも body の形が違えば null を返すが、refresh token は消さない', async () => {
    localStorage.setItem('oryzae_admin_refresh_token', 'rt-1');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ session: { accessToken: 123 } }),
    );

    const result = await tryRefreshToken();

    expect(result).toBeNull();
    // サーバー側の一時的な不具合で強制ログアウトさせないこと。
    expect(localStorage.getItem('oryzae_admin_refresh_token')).toBe('rt-1');
  });

  it('401 なら null を返し、トークンを消す（＝失効として扱う）', async () => {
    localStorage.setItem('oryzae_admin_refresh_token', 'rt-1');
    localStorage.setItem('oryzae_admin_access_token', 'at-1');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'invalid' }, 401));

    const result = await tryRefreshToken();

    expect(result).toBeNull();
    expect(localStorage.getItem('oryzae_admin_refresh_token')).toBeNull();
    expect(localStorage.getItem('oryzae_admin_access_token')).toBeNull();
  });
});
