import { clearTokens, getRefreshToken, setTokens } from '@/lib/auth';
import { isObject, readJson, readStringField } from '@/lib/json';

export interface ApiClient {
  baseUrl: string;
  headers: Record<string, string>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

// Issue #362: 楽観的データ取得では、失効した access token で複数のリクエストが
// 同時に 401 になり得る（N 個のデータフック × 複数の useAuth インスタンス）。
// Supabase は refresh token をローテートするため、並発リフレッシュは二重実行＝
// 後発がトークン再利用エラーで失敗する。in-flight な refresh を1本に集約し、
// 同時呼び出しは同じ Promise を共有する（解決後にクリアし次回は再実行可能）。
let inFlightRefresh: Promise<string | null> | null = null;

/** refresh レスポンスから session を取り出す。形が違えば null（＝失効扱い）。 */
function readSession(input: unknown): { accessToken: string; refreshToken: string } | null {
  if (!isObject(input)) return null;
  const session = input.session;
  const accessToken = readStringField(session, 'accessToken');
  const refreshToken = readStringField(session, 'refreshToken');
  if (accessToken === null || refreshToken === null) return null;
  return { accessToken, refreshToken };
}

export async function tryRefreshToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    // 200 なのに body が壊れているのはサーバー側の問題で、refresh token が
    // 無効になったわけではない。ここで clearTokens すると一時的な不具合で
    // 全セッションが強制ログアウトになるため、今回の refresh を失敗扱いにするだけ。
    const session = readSession(await readJson(res));
    if (!session) return null;
    setTokens(session.accessToken, session.refreshToken);
    return session.accessToken;
  })();

  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}

export function createApiClient(accessToken?: string): ApiClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  async function doFetch(path: string, init?: RequestInit): Promise<Response> {
    const isFormData = init?.body instanceof FormData;
    const requestHeaders = isFormData
      ? (() => {
          const h: Record<string, string> = {};
          if (headers.Authorization) h.Authorization = headers.Authorization;
          return h;
        })()
      : { ...headers, ...init?.headers };

    const res = await fetch(path, { ...init, headers: requestHeaders });

    // Don't retry auth endpoints to avoid loops
    if (res.status !== 401 || path.startsWith('/api/v1/auth/')) return res;

    const newToken = await tryRefreshToken();
    if (!newToken) return res;

    headers.Authorization = `Bearer ${newToken}`;
    const retryHeaders = isFormData
      ? { Authorization: `Bearer ${newToken}` }
      : { ...headers, ...init?.headers };

    return fetch(path, { ...init, headers: retryHeaders });
  }

  return {
    baseUrl: '',
    headers,
    fetch: doFetch,
  };
}
