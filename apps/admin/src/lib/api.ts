import { clearTokens, getRefreshToken, setTokens } from '@/lib/auth';

export interface ApiClient {
  headers: Record<string, string>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

// Issue #362: 失効した access token で複数リクエストが同時に 401 になっても、
// refresh を1回に集約する（Supabase の refresh token ローテーションによる
// 並発二重実行＝後発が再利用エラーで失敗するのを防ぐ）。
let inFlightRefresh: Promise<string | null> | null = null;

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

    // @type-assertion-allowed: refresh エンドポイントの JSON レスポンスの最小型
    const data = (await res.json()) as {
      session: { accessToken: string; refreshToken: string };
    };
    setTokens(data.session.accessToken, data.session.refreshToken);
    return data.session.accessToken;
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
    const res = await fetch(path, { ...init, headers: { ...headers, ...init?.headers } });

    // Issue #362: 401 は refresh して1度だけ再試行（auth 系はループ回避で除外）。
    // これによりトークン直読のデータフックが失効時に自己修復し、
    // layout の即マウント（認証検証を待たない）を安全にする。
    if (res.status !== 401 || path.startsWith('/api/v1/auth/')) return res;

    const newToken = await tryRefreshToken();
    if (!newToken) return res;

    headers.Authorization = `Bearer ${newToken}`;
    return fetch(path, { ...init, headers: { ...headers, ...init?.headers } });
  }

  return {
    headers,
    fetch: doFetch,
  };
}
